const pool = require("../config/db");
const logger = require("../config/logger");
const { generateToken, hashToken } = require("../services/deviceRegistryService");
const deviceFleetService = require("../services/deviceFleetService");
const deviceConnectionRegistry = require("../services/deviceConnectionRegistry");
const auditLogService = require("../services/auditLogService");
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
        const { device_id: deviceId, shop_id: shopId } = req.body;

        const rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);

        const result = await pool.query(
            `INSERT INTO iot_devices (device_id, device_token_hash, shop_id)
       VALUES ($1, $2, $3)
       RETURNING id, device_id, shop_id, status, created_at`,
            [deviceId, tokenHash, shopId],
        );

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
const listDevices = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, device_id, shop_id, status, token_expires_at, last_seen_at, created_at
       FROM iot_devices
       ORDER BY created_at DESC`,
        );

        return res.status(200).json({ devices: result.rows });
    } catch (err) {
        return next(err);
    }
};

// PATCH /api/admin/iot/devices/:deviceId/status
const setDeviceStatus = async (req, res, next) => {
    try {
        const { deviceId } = req.params;
        const { status } = req.body;

        const result = await pool.query(
            `UPDATE iot_devices SET status = $1 WHERE device_id = $2
       RETURNING id, device_id, shop_id, status`,
            [status, deviceId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Device not found" });
        }

        return res.status(200).json({ device: result.rows[0] });
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
    getFleet,
    recalibrateDevice,
    persistReading,
    recordRejectionAndMaybeFlag,
};
