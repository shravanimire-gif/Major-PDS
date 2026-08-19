const pool = require("../config/db");
const logger = require("../config/logger");
const { generateToken, hashToken } = require("../services/deviceRegistryService");
const deviceFleetService = require("../services/deviceFleetService");
const deviceConnectionRegistry = require("../services/deviceConnectionRegistry");
const auditLogService = require("../services/auditLogService");
const liveReadingBus = require("../services/liveReadingBus");
const {
    MIN_VALID_GRAMS,
    MAX_VALID_GRAMS,
    RECALIBRATION_REJECT_THRESHOLD,
    RECALIBRATION_REJECT_WINDOW_MS,
    TOKEN_ROTATION_GRACE_MS,
} = require("../config/iot");

// In-memory rolling rejection tracker per device (Phase 2's
// needs_recalibration signal) — not persisted/shared across instances,
// matching liveReadingBus's existing "single backend instance" scope.
const rejectionTimestampsByDevice = new Map();

const recordRejectionAndMaybeFlag = (deviceId) => {
    const now = Date.now();
    const timestamps = (rejectionTimestampsByDevice.get(deviceId) || []).filter(
        (ts) => now - ts <= RECALIBRATION_REJECT_WINDOW_MS,
    );
    timestamps.push(now);
    rejectionTimestampsByDevice.set(deviceId, timestamps);

    if (timestamps.length >= RECALIBRATION_REJECT_THRESHOLD) {
        pool
            .query(`UPDATE iot_devices SET needs_recalibration = true WHERE device_id = $1`, [deviceId])
            .catch((err) =>
                logger.error("Failed to flag device needs_recalibration", { deviceId, message: err.message }),
            );
    }

    // Phase 3 — DEVICE_ANOMALY needs a 24h rejection rate; this is a
    // persisted log of the event, separate from the in-memory 60s/3-strikes
    // counter above (which stays in-memory, unchanged).
    pool
        .query(`INSERT INTO sensor_reading_rejections (device_id) VALUES ($1)`, [deviceId])
        .catch((err) =>
            logger.error("Failed to log sensor reading rejection", { deviceId, message: err.message }),
        );
};

// POST /api/admin/iot/devices
// Returns the plaintext token exactly once — only device_token_hash is ever
// persisted, so this response is the only chance to capture it (flash it
// into config.h on the ESP32 and it's gone from the server side).
const registerDevice = async (req, res, next) => {
    try {
        const { device_id: deviceId, shop_id: shopId, device_name: deviceName } = req.body;

        // shop_id is optional: an admin may register the hardware first (the
        // UID is a property of the board, known as soon as it is plugged in)
        // and assign it to a shop as a separate, audited action. A device with
        // no shop cannot connect at all — deviceRegistryService.validateToken
        // rejects it with reason 'unassigned' — so registering early is inert,
        // not a security hole.
        if (shopId) {
            const shopCheck = await pool.query(`SELECT id, is_active FROM shops WHERE id = $1`, [shopId]);
            if (shopCheck.rows.length === 0) {
                return res.status(400).json({ error: "shop_id does not exist" });
            }
            if (!shopCheck.rows[0].is_active) {
                return res.status(400).json({ error: "Shop is not active" });
            }
        }

        const rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);

        const result = await pool.query(
            `INSERT INTO iot_devices (device_id, device_token_hash, shop_id, device_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, device_id, shop_id, device_name, status, created_at`,
            [deviceId, tokenHash, shopId || null, deviceName || null],
        );

        await auditLogService.record({
            actorType: "admin",
            actorId: req.user?.id,
            action: "register_device",
            target: deviceId,
            meta: { shopId: shopId || null },
        });

        return res.status(201).json({
            device: result.rows[0],
            token: rawToken,
        });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(409).json({ error: "device_id already registered" });
        }
        if (err.code === "23503") {
            return res.status(400).json({ error: "shop_id does not exist" });
        }
        return next(err);
    }
};

// The states a dispense_sessions row can be in while it is still capable of
// producing a business transaction. Reassigning or unassigning a device out
// from under one of these would break the device.shop_id === session.shop_id
// invariant the commit relies on, so both actions refuse while one exists.
const LIVE_SESSION_STATES = "('active','attached','weighing','confirming')";

const findLiveSessionForDevice = async (deviceId) => {
    const result = await pool.query(
        `SELECT id, shop_id, state FROM dispense_sessions
      WHERE device_id = $1 AND state IN ${LIVE_SESSION_STATES}
      LIMIT 1`,
        [deviceId],
    );
    return result.rows[0] || null;
};

// PATCH /api/admin/iot/devices/:deviceId/assignment
// body: { shop_id: <uuid> }  -> assign / reassign
//       { shop_id: null }    -> unassign
//
// This is the ONLY way a device's shop changes. The device itself can never
// influence it: nothing the ESP32 or the bridge sends is consulted here, and
// the /ws/iot handshake reads shop_id back out of this row rather than from
// any frame. That is what makes "a device cannot claim another shop" true by
// construction rather than by validation.
const setDeviceAssignment = async (req, res, next) => {
    try {
        const { deviceId } = req.params;
        const shopId = req.body.shop_id ?? null;

        const deviceResult = await pool.query(
            `SELECT device_id, shop_id FROM iot_devices WHERE device_id = $1`,
            [deviceId],
        );
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: "Device not found" });
        }
        const previousShopId = deviceResult.rows[0].shop_id;

        // Checked FIRST, before anything about the destination shop: this
        // refusal is a fact about THIS device, and it applies equally to an
        // assign, a reassign and an unassign. Validating the target shop first
        // would report "that shop already has a device" for a request whose
        // real problem is that grain is on the pan right now.
        const liveSession = await findLiveSessionForDevice(deviceId);
        if (liveSession) {
            return res.status(409).json({
                error: `Device is mid-dispense (session ${liveSession.id} is ${liveSession.state}). Wait for it to finish or cancel it first.`,
            });
        }

        if (shopId) {
            const shopCheck = await pool.query(`SELECT id, is_active FROM shops WHERE id = $1`, [shopId]);
            if (shopCheck.rows.length === 0) {
                return res.status(400).json({ error: "shop_id does not exist" });
            }
            if (!shopCheck.rows[0].is_active) {
                return res.status(400).json({ error: "Shop is not active" });
            }

            // One physical scale per shop: attachSession picks the shop's
            // active device with LIMIT 1, so a second one would make which
            // device gates a session non-deterministic.
            const existing = await pool.query(
                `SELECT device_id FROM iot_devices
          WHERE shop_id = $1 AND status = 'active' AND device_id <> $2
          LIMIT 1`,
                [shopId, deviceId],
            );
            if (existing.rows.length > 0) {
                return res.status(409).json({
                    error: `Shop already has an active device (${existing.rows[0].device_id}). Unassign or disable it first.`,
                });
            }
        }

        const updated = await pool.query(
            `UPDATE iot_devices SET shop_id = $1 WHERE device_id = $2
       RETURNING id, device_id, shop_id, device_name, status`,
            [shopId, deviceId],
        );

        await auditLogService.record({
            actorType: "admin",
            actorId: req.user?.id,
            action: shopId ? "assign_device" : "unassign_device",
            target: deviceId,
            meta: { fromShopId: previousShopId, toShopId: shopId },
        });

        // A reassigned/unassigned device must not keep streaming into its old
        // shop's live view under its old authorisation. Dropping the socket is
        // the honest way to apply the change: the bridge reconnects within
        // seconds and is re-authorised against the new row (or refused, if it
        // is now unassigned).
        const disconnected = deviceConnectionRegistry.closeConnection(
            deviceId,
            shopId ? "reassigned" : "unassigned",
        );

        if (previousShopId) {
            liveReadingBus.publish(previousShopId, {
                type: "device_status",
                online: false,
                deviceId,
            });
        }

        logger.info("[IoT] Device assignment changed", {
            deviceId,
            fromShopId: previousShopId,
            toShopId: shopId,
            disconnected,
        });

        return res.status(200).json({ device: updated.rows[0], disconnected });
    } catch (err) {
        return next(err);
    }
};

// POST /api/admin/iot/devices/:deviceId/rotate-token
// The previous token keeps working for TOKEN_ROTATION_GRACE_MS afterward
// (src/services/deviceRegistryService.js's validateToken checks it as a
// fallback) so a device already mid-reconnect-backoff with the old token
// isn't hard-locked out the instant this runs.
const rotateToken = async (req, res, next) => {
    try {
        const { deviceId } = req.params;

        const rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);
        const graceExpiresAt = new Date(Date.now() + TOKEN_ROTATION_GRACE_MS);

        const result = await pool.query(
            `UPDATE iot_devices
       SET previous_token_hash = device_token_hash,
           previous_token_expires_at = $1,
           device_token_hash = $2
       WHERE device_id = $3
       RETURNING id, device_id, shop_id, status`,
            [graceExpiresAt, tokenHash, deviceId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Device not found" });
        }

        await auditLogService.record({
            actorType: "admin",
            actorId: req.user?.id,
            action: "rotate_token",
            target: deviceId,
            meta: { graceExpiresAt },
        });

        return res.status(200).json({ device: result.rows[0], token: rawToken });
    } catch (err) {
        return next(err);
    }
};

// GET /api/admin/iot/fleet
const getFleet = async (req, res, next) => {
    try {
        const fleet = await deviceFleetService.getFleet();
        return res.status(200).json({ devices: fleet });
    } catch (err) {
        return next(err);
    }
};

// POST /api/admin/iot/devices/:deviceId/recalibrate
// Never disconnects the device or interrupts an active session — purely
// queues/pushes a message the device *would* act on if the firmware
// understood it (it doesn't yet this phase; see PHASE3_DONE.md).
const recalibrateDevice = async (req, res, next) => {
    try {
        const { deviceId } = req.params;

        const deviceResult = await pool.query(`SELECT device_id FROM iot_devices WHERE device_id = $1`, [
            deviceId,
        ]);
        if (deviceResult.rows.length === 0) {
            return res.status(404).json({ error: "Device not found" });
        }

        await pool.query(`UPDATE iot_devices SET calibrated_at = NOW() WHERE device_id = $1`, [deviceId]);
        const delivered = deviceConnectionRegistry.sendRecalibrate(deviceId);

        await auditLogService.record({
            actorType: "admin",
            actorId: req.user?.id,
            action: "recalibrate_device",
            target: deviceId,
            meta: { delivered },
        });

        return res.status(200).json({
            device_id: deviceId,
            delivered,
            message: delivered
                ? "Recalibration message sent to the connected device."
                : "Device is offline — recalibration will be sent the next time it connects.",
        });
    } catch (err) {
        return next(err);
    }
};

// GET /api/admin/iot/devices
// The Admin Panel's IoT Devices module. One row per registered device with
// everything that screen shows: hardware UID, name, lifecycle status, live
// connectivity, assigned shop + that shop's shopkeeper, last seen, firmware
// version and the most recent sensor reading.
//
// LEFT JOIN on shops (not JOIN): an unassigned device must still appear here —
// it is precisely the device an admin has come to this page to assign.
//
// `current_weight_grams` is the latest SENSOR READING and nothing more. It is
// read from sensor_readings, never from dispense_records or transactions, so
// there is no path by which looking at this number could be mistaken for, or
// turn into, a committed dispense. Only commitSession writes business rows.
const listDevices = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
          d.id,
          d.device_id,
          d.device_name,
          d.shop_id,
          d.status,
          d.firmware_version,
          d.token_expires_at,
          d.last_seen_at,
          d.needs_recalibration,
          d.calibrated_at,
          d.created_at,
          s.shop_name,
          s.shop_code,
          s.is_active AS shop_is_active,
          u.name  AS shopkeeper_name,
          u.email AS shopkeeper_email,
          r.grams_int AS current_weight_grams,
          r.taken_at  AS current_weight_at
       FROM iot_devices d
       LEFT JOIN shops s ON s.id = d.shop_id
       LEFT JOIN users u ON u.id = s.shopkeeper_id
       LEFT JOIN LATERAL (
         SELECT grams_int, taken_at
           FROM sensor_readings sr
          WHERE sr.device_id = d.device_id
          ORDER BY sr.taken_at DESC
          LIMIT 1
       ) r ON true
       ORDER BY d.created_at DESC`,
        );

        const devices = result.rows.map((row) => ({
            ...row,
            // Registry lifecycle (active/inactive/revoked) and connectivity
            // (online/stale/offline) are different questions and are reported
            // as different fields on purpose. A device row existing, or being
            // 'active', is never by itself a reason to show ONLINE.
            connectivity: deviceFleetService.deriveStatus(row.device_id, row.last_seen_at),
        }));

        return res.status(200).json({ devices });
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/admin/iot/devices/:deviceId/status
// Backs the Admin Panel's Enable (-> 'active') and Disable (-> 'inactive')
// actions, and token revocation (-> 'revoked').
const setDeviceStatus = async (req, res, next) => {
    try {
        const { deviceId } = req.params;
        const { status } = req.body;

        const existing = await pool.query(`SELECT device_id, status FROM iot_devices WHERE device_id = $1`, [
            deviceId,
        ]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "Device not found" });
        }

        // Disabling mid-dispense would strand a session whose device can no
        // longer authenticate: the weighing would simply stop, with the wallet
        // untouched but the session stuck until the idle sweep marked it
        // device_lost. Refusing is clearer than producing that state silently.
        if (status !== "active") {
            const liveSession = await findLiveSessionForDevice(deviceId);
            if (liveSession) {
                return res.status(409).json({
                    error: `Device is mid-dispense (session ${liveSession.id} is ${liveSession.state}). Wait for it to finish or cancel it first.`,
                });
            }
        }

        const result = await pool.query(
            `UPDATE iot_devices SET status = $1 WHERE device_id = $2
       RETURNING id, device_id, shop_id, device_name, status`,
            [status, deviceId],
        );

        await auditLogService.record({
            actorType: "admin",
            actorId: req.user?.id,
            action: "set_device_status",
            target: deviceId,
            meta: { from: existing.rows[0].status, to: status },
        });

        // A device that is no longer 'active' must stop being able to stream.
        // The handshake already refuses it, but an ALREADY-open socket would
        // otherwise survive until it happened to reconnect.
        let disconnected = false;
        if (status !== "active") {
            disconnected = deviceConnectionRegistry.closeConnection(deviceId, `status_${status}`);
            const shopId = result.rows[0].shop_id;
            if (shopId) {
                liveReadingBus.publish(shopId, { type: "device_status", online: false, deviceId });
            }
        }

        return res.status(200).json({ device: result.rows[0], disconnected });
    } catch (err) {
        return next(err);
    }
};

// Called by ws/iotSocketServer.js for each validated device frame — not an
// HTTP route. Re-validates range/device existence at the DB-write boundary
// (defense in depth beneath the WS frame's Joi schema) and never throws, per
// the "backend never crashes on malformed device frames" requirement.
const persistReading = async (deviceId, gramsInt, sessionId, takenAt) => {
    if (!Number.isInteger(gramsInt) || gramsInt < MIN_VALID_GRAMS || gramsInt > MAX_VALID_GRAMS) {
        recordRejectionAndMaybeFlag(deviceId);
        return { success: false, error: "grams out of range" };
    }

    try {
        const deviceResult = await pool.query(
            `SELECT device_id, shop_id FROM iot_devices WHERE device_id = $1`,
            [deviceId],
        );

        if (deviceResult.rows.length === 0) {
            return { success: false, error: "unknown device_id" };
        }

        const result = await pool.query(
            `INSERT INTO sensor_readings (device_id, grams_int, taken_at, session_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, device_id, grams_int, taken_at, session_id`,
            [deviceId, gramsInt, takenAt, sessionId || null],
        );

        return {
            success: true,
            reading: result.rows[0],
            shopId: deviceResult.rows[0].shop_id,
        };
    } catch (err) {
        logger.error("Failed to persist sensor reading", {
            deviceId,
            message: err.message,
        });
        return { success: false, error: "persistence failed" };
    }
};

module.exports = {
    registerDevice,
    rotateToken,
    listDevices,
    setDeviceStatus,
    setDeviceAssignment,
    getFleet,
    recalibrateDevice,
    persistReading,
    recordRejectionAndMaybeFlag,
};
