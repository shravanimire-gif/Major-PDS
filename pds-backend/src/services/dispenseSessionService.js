const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const logger = require("../config/logger");
const { buildRowHash } = require("./chainRowBuilder");
const { enqueueAnchor } = require("./anchorEnqueuer");
const dispenseSessionBus = require("./dispenseSessionBus");
const metrics = require("../config/metrics");

const SESSION_TTL_MS = 60 * 1000;

const COMMODITY_BALANCE_COLUMN = {
    rice: "rice_balance_kg",
    wheat: "wheat_balance_kg",
    sugar: "sugar_balance_kg",
};

const toNumber = (value) => Number.parseFloat(value || 0);

const computeToleranceGrams = async (commodity, entitledGrams) => {
    const result = await pool.query(
        `SELECT min_tolerance_grams, tolerance_pct FROM commodity_tolerances WHERE commodity = $1`,
        [commodity],
    );
    const row = result.rows[0] || { min_tolerance_grams: 20, tolerance_pct: 1.0 };
    const pctBased = Math.round((entitledGrams * Number(row.tolerance_pct)) / 100);
    return Math.max(Number(row.min_tolerance_grams), pctBased);
};

// POST /api/dispense/session — called by the shopkeeper's own screen AFTER
// they've already scanned + validated the beneficiary's existing qr_sessions
// QR (see iot-device/PHASE2_DONE.md for why no new QR is introduced here).
// Re-validates and consumes that same qr_sessions row, ties this new
// session's identity assurance to the proven QR mechanism.
const createSession = async ({ shopId, rationCardId, commodity, entitledGrams, qrSessionId }) => {
    if (!COMMODITY_BALANCE_COLUMN[commodity]) {
        return { ok: false, status: 400, code: "IOT_INVALID_COMMODITY", message: "commodity must be rice, wheat, or sugar" };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const qrResult = await client.query(
            `SELECT session_id, ration_card_id, shop_id, is_used, expires_at
       FROM qr_sessions WHERE session_id = $1 FOR UPDATE`,
            [qrSessionId],
        );
        if (qrResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { ok: false, status: 401, code: "IOT_QR_INVALID", message: "Invalid QR session" };
        }
        const qr = qrResult.rows[0];
        if (qr.ration_card_id !== rationCardId || qr.shop_id !== shopId) {
            await client.query("ROLLBACK");
            return { ok: false, status: 400, code: "IOT_QR_MISMATCH", message: "QR does not match beneficiary/shop" };
        }
        if (qr.is_used) {
            await client.query("ROLLBACK");
            return { ok: false, status: 409, code: "IOT_SESSION_ALREADY_USED", message: "QR session already used" };
        }
        if (new Date(qr.expires_at) < new Date()) {
            await client.query("ROLLBACK");
            return { ok: false, status: 410, code: "IOT_SESSION_EXPIRED", message: "QR session expired" };
        }

        const walletResult = await client.query(
            `SELECT rice_balance_kg, wheat_balance_kg, sugar_balance_kg FROM wallets WHERE ration_card_id = $1`,
            [rationCardId],
        );
        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { ok: false, status: 404, code: "IOT_WALLET_NOT_FOUND", message: "Wallet not found" };
        }
        const balanceKg = toNumber(walletResult.rows[0][COMMODITY_BALANCE_COLUMN[commodity]]);
        if (entitledGrams > balanceKg * 1000) {
            await client.query("ROLLBACK");
            return {
                ok: false,
                status: 400,
                code: "IOT_INSUFFICIENT_BALANCE",
                message: "Entitled amount exceeds wallet balance",
            };
        }

        const toleranceGrams = await computeToleranceGrams(commodity, entitledGrams);
        const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

        const sessionResult = await client.query(
            `INSERT INTO dispense_sessions (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, expires_at`,
            [shopId, rationCardId, commodity, entitledGrams, toleranceGrams, expiresAt],
        );
        const session = sessionResult.rows[0];

        await client.query(`UPDATE qr_sessions SET is_used = true, used_at = NOW() WHERE session_id = $1`, [
            qrSessionId,
        ]);

        const jti = crypto.randomUUID();
        const sessionJwt = jwt.sign({ sessionId: session.id, jti }, process.env.JWT_SECRET, {
            expiresIn: Math.floor(SESSION_TTL_MS / 1000),
        });

        await client.query("COMMIT");

        metrics.sessionsCounter.inc({ shop_id: shopId });
        logger.info("[IoT] Dispense session created", {
            shopId,
            sessionId: session.id,
            commodity,
            entitledGrams,
        });

        return {
            ok: true,
            sessionId: session.id,
            sessionJwt,
            expiresAt: session.expires_at,
            toleranceGrams,
        };
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {
            // ignore rollback failure, surface the original error
        }
        logger.error("[IoT] createSession failed", { shopId, message: err.message });
        return { ok: false, status: 500, code: "IOT_SESSION_CREATE_FAILED", message: "Failed to create session" };
    } finally {
        client.release();
    }
};

// POST /api/dispense/session/:id/attach
const attachSession = async (sessionId, sessionJwt, shopId) => {
    let decoded;
    try {
        decoded = jwt.verify(sessionJwt, process.env.JWT_SECRET);
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return { ok: false, status: 410, code: "IOT_SESSION_EXPIRED", message: "Session expired" };
        }
        return { ok: false, status: 401, code: "IOT_SESSION_INVALID", message: "Invalid session token" };
    }

    if (decoded.sessionId !== sessionId) {
        return { ok: false, status: 400, code: "IOT_SESSION_MISMATCH", message: "Token does not match session" };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const jtiCheck = await client.query(`SELECT jti FROM used_jtis WHERE jti = $1`, [decoded.jti]);
        if (jtiCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return { ok: false, status: 409, code: "IOT_SESSION_ALREADY_USED", message: "Session token already used" };
        }

        const sessionResult = await client.query(
            `SELECT id, shop_id, state, expires_at FROM dispense_sessions WHERE id = $1 FOR UPDATE`,
            [sessionId],
        );
        if (sessionResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { ok: false, status: 404, code: "IOT_SESSION_NOT_FOUND", message: "Session not found" };
        }
        const session = sessionResult.rows[0];
        if (session.shop_id !== shopId) {
            await client.query("ROLLBACK");
            return { ok: false, status: 403, code: "IOT_SESSION_WRONG_SHOP", message: "Session belongs to another shop" };
        }
        if (session.state !== "active") {
            await client.query("ROLLBACK");
            return { ok: false, status: 409, code: "IOT_SESSION_NOT_ACTIVE", message: `Session is ${session.state}` };
        }
        if (new Date(session.expires_at) < new Date()) {
            await client.query("ROLLBACK");
            await pool.query(`UPDATE dispense_sessions SET state = 'expired' WHERE id = $1`, [sessionId]);
            return { ok: false, status: 410, code: "IOT_SESSION_EXPIRED", message: "Session expired" };
        }

        const deviceResult = await client.query(
            `SELECT device_id FROM iot_devices WHERE shop_id = $1 AND status = 'active' LIMIT 1`,
            [shopId],
        );
        if (deviceResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { ok: false, status: 404, code: "IOT_DEVICE_NOT_FOUND", message: "No active IoT device for this shop" };
        }
        const deviceId = deviceResult.rows[0].device_id;

        await client.query(`INSERT INTO used_jtis (jti, session_id) VALUES ($1, $2)`, [decoded.jti, sessionId]);
        await client.query(
            `UPDATE dispense_sessions SET state = 'attached', device_id = $1, attached_at = NOW() WHERE id = $2`,
            [deviceId, sessionId],
        );

        await client.query("COMMIT");

        dispenseSessionBus.publish(sessionId, { type: "state", state: "attached" });

        return { ok: true, sessionId, deviceId, state: "attached" };
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {
            // ignore rollback failure, surface the original error
        }
        logger.error("[IoT] attachSession failed", { message: err.message, sessionId });
        return { ok: false, status: 500, code: "IOT_ATTACH_FAILED", message: "Failed to attach session" };
    } finally {
        client.release();
    }
};

// POST /api/dispense/session/:id/cancel — the shopkeeper's Cancel button,
// available any time before commit.
const cancelSession = async (sessionId, shopId) => {
    const result = await pool.query(
        `UPDATE dispense_sessions
     SET state = 'cancelled'
     WHERE id = $1 AND shop_id = $2
       AND state IN ('active','attached','weighing','confirming')
     RETURNING id`,
        [sessionId, shopId],
    );

    if (result.rows.length === 0) {
        return {
            ok: false,
            status: 409,
            code: "IOT_SESSION_NOT_CANCELLABLE",
            message: "Session cannot be cancelled in its current state",
        };
    }

    dispenseSessionBus.publish(sessionId, { type: "state", state: "cancelled" });
    return { ok: true, sessionId, state: "cancelled" };
};

// GET /api/dispense/session/:id — status fallback for reconnects.
const getSessionStatus = async (sessionId, shopId) => {
    const result = await pool.query(
        `SELECT id, state, commodity, entitled_grams, tolerance_grams, device_id, expires_at
     FROM dispense_sessions WHERE id = $1 AND shop_id = $2`,
        [sessionId, shopId],
    );
    if (result.rows.length === 0) {
        return { ok: false, status: 404, code: "IOT_SESSION_NOT_FOUND", message: "Session not found" };
    }
    return { ok: true, session: result.rows[0] };
};

// Called by ws/iotSocketServer.js on every reading to find the session (if
// any) currently gating this device — the exact lookup the (device_id,
// state) index on dispense_sessions exists for.
const findAttachedSessionForDevice = async (deviceId) => {
    const result = await pool.query(
        `SELECT id, state, entitled_grams, tolerance_grams, ration_card_id, shop_id, commodity
     FROM dispense_sessions
     WHERE device_id = $1 AND state IN ('attached','weighing','confirming')
     LIMIT 1`,
        [deviceId],
    );
    return result.rows[0] || null;
};

// State-machine transitions driven by ws/iotSocketServer.js as readings
// arrive. Each returns true iff it actually applied (guards against racing
// with a cancel/device_lost that happened in between).
const beginWeighing = async (sessionId) => {
    const result = await pool.query(
        `UPDATE dispense_sessions SET state = 'weighing' WHERE id = $1 AND state = 'attached' RETURNING id`,
        [sessionId],
    );
    if (result.rows.length > 0) {
        dispenseSessionBus.publish(sessionId, { type: "state", state: "weighing" });
        return true;
    }
    return false;
};

const beginConfirming = async (sessionId) => {
    const result = await pool.query(
        `UPDATE dispense_sessions SET state = 'confirming' WHERE id = $1 AND state = 'weighing' RETURNING id`,
        [sessionId],
    );
    return result.rows.length > 0;
};

const revertToWeighing = async (sessionId) => {
    const result = await pool.query(
        `UPDATE dispense_sessions SET state = 'weighing' WHERE id = $1 AND state = 'confirming' RETURNING id`,
        [sessionId],
    );
    if (result.rows.length > 0) {
        dispenseSessionBus.publish(sessionId, { type: "state", state: "weighing" });
        return true;
    }
    return false;
};

// Called by ws/iotSocketServer.js when a device with an attached session
// disconnects — no partial commits, session moves to a terminal state.
const markDeviceLost = async (deviceId) => {
    const result = await pool.query(
        `UPDATE dispense_sessions
     SET state = 'device_lost'
     WHERE device_id = $1 AND state IN ('attached','weighing','confirming')
     RETURNING id`,
        [deviceId],
    );
    for (const row of result.rows) {
        dispenseSessionBus.publish(row.id, { type: "state", state: "device_lost" });
    }
};

// Lazily expires an 'active' (never attached) session found past its TTL —
// avoided adding a dedicated sweep cron for this since attach/create already
// check expiry inline; this just keeps the state field accurate for readers.
const expireIfStale = async (sessionId) => {
    await pool.query(
        `UPDATE dispense_sessions SET state = 'expired'
     WHERE id = $1 AND state = 'active' AND expires_at < NOW()`,
        [sessionId],
    );
};

// The single-transaction commit: hash-chain link + wallet debit (lock-free,
// WHERE-guarded) + ledger row + session state, all-or-nothing. Called from
// ws/iotSocketServer.js's state machine once the stability rule holds
// through the confirming countdown.
const commitSession = async (sessionId, measuredGrams) => {
    const endCommitTimer = metrics.commitLatencyHistogram.startTimer();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const sessionResult = await client.query(
            `SELECT id, shop_id, ration_card_id, commodity, entitled_grams, state
       FROM dispense_sessions WHERE id = $1 FOR UPDATE`,
            [sessionId],
        );
        if (sessionResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return { success: false, reason: "not_found" };
        }
        const session = sessionResult.rows[0];
        if (!["weighing", "confirming"].includes(session.state)) {
            await client.query("ROLLBACK");
            return { success: false, reason: `invalid_state:${session.state}` };
        }

        const columnName = COMMODITY_BALANCE_COLUMN[session.commodity];
        if (!columnName) {
            await client.query("ROLLBACK");
            return { success: false, reason: "invalid_commodity" };
        }

        // Per-shop hash-chain lock — serializes commits for this shop only
        // (a single ESP32 per shop means dispenses there are already
        // physically sequential, so this never contends across shops).
        const chainResult = await client.query(
            `SELECT row_hash FROM dispense_records WHERE shop_id = $1 ORDER BY committed_at DESC LIMIT 1 FOR UPDATE`,
            [session.shop_id],
        );
        const prevHash = chainResult.rows[0]?.row_hash || null;

        const measuredKg = Math.round((measuredGrams / 1000) * 100) / 100;

        // No row lock here — deliberate: the WHERE clause is the concurrency
        // guard for the wallet debit.
        const walletUpdate = await client.query(
            `UPDATE wallets SET ${columnName} = ${columnName} - $1, updated_at = NOW()
       WHERE ration_card_id = $2 AND ${columnName} >= $1`,
            [measuredKg, session.ration_card_id],
        );

        if (walletUpdate.rowCount === 0) {
            await client.query("ROLLBACK");
            await pool.query(`UPDATE dispense_sessions SET state = 'failed_insufficient_balance' WHERE id = $1`, [
                sessionId,
            ]);
            dispenseSessionBus.publish(sessionId, { type: "state", state: "failed_insufficient_balance" });
            return { success: false, reason: "insufficient_balance" };
        }

        const fields = {
            sessionId: session.id,
            rationCardId: session.ration_card_id,
            shopId: session.shop_id,
            commodity: session.commodity,
            entitledGrams: session.entitled_grams,
            measuredGrams,
        };
        const rowHash = buildRowHash(prevHash, fields);

        const recordResult = await client.query(
            `INSERT INTO dispense_records
         (session_id, ration_card_id, shop_id, commodity, entitled_grams, measured_grams, prev_hash, row_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
            [
                session.id,
                session.ration_card_id,
                session.shop_id,
                session.commodity,
                session.entitled_grams,
                measuredGrams,
                prevHash,
                rowHash,
            ],
        );

        await client.query(`UPDATE dispense_sessions SET state = 'committed', committed_at = NOW() WHERE id = $1`, [
            sessionId,
        ]);

        await client.query("COMMIT");

        const dispenseRecordId = recordResult.rows[0].id;
        enqueueAnchor(dispenseRecordId).catch((err) =>
            logger.error("[IoT] enqueueAnchor threw", { message: err.message, dispenseRecordId }),
        );

        dispenseSessionBus.publish(sessionId, {
            type: "state",
            state: "committed",
            measuredGrams,
            dispenseRecordId,
        });

        return { success: true, dispenseRecordId };
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {
            // ignore rollback failure, surface the original error
        }
        logger.error("[IoT] commitSession failed", { message: err.message, sessionId });
        return { success: false, reason: "error" };
    } finally {
        client.release();
        endCommitTimer();
    }
};

module.exports = {
    createSession,
    attachSession,
    cancelSession,
    getSessionStatus,
    findAttachedSessionForDevice,
    beginWeighing,
    beginConfirming,
    revertToWeighing,
    markDeviceLost,
    expireIfStale,
    commitSession,
    COMMODITY_BALANCE_COLUMN,
};
