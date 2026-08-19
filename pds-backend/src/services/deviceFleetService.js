const pool = require("../config/db");
const deviceConnectionRegistry = require("../services/deviceConnectionRegistry");
const { DEVICE_STALE_THRESHOLD_MS } = require("../config/iot");

// online: has a live /ws/iot connection right now.
// stale: no live connection, but last_seen_at is recent (<=2min) — likely
// mid-reconnect (firmware backs off up to 30s between attempts).
// offline: no live connection and last_seen_at is old (or never connected).
const deriveStatus = (deviceId, lastSeenAt) => {
    if (deviceConnectionRegistry.isOnline(deviceId)) {
        return "online";
    }
    if (lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= DEVICE_STALE_THRESHOLD_MS) {
        return "stale";
    }
    return "offline";
};

const calibrationAgeDays = (calibratedAt) => {
    if (!calibratedAt) return null;
    const ms = Date.now() - new Date(calibratedAt).getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000));
};

// GET /api/admin/iot/fleet — every device, grouped by shop on the frontend
// (this returns a flat list with shop_name attached; grouping is a display
// concern, not a query concern).
// LEFT JOIN on shops, not JOIN: since migration 026 a device may be registered
// but unassigned, and an unassigned device disappearing from the fleet view is
// exactly the wrong behaviour — it is the device most in need of attention.
//
// device_name/firmware_version come along so the operational view and the
// Settings > Devices view agree about the same hardware, and the latest sensor
// reading is attached so "is it actually weighing?" can be answered without
// opening a per-shop live socket. That reading is a SENSOR VALUE only: nothing
// on this path writes a transaction, a dispense_record or a wallet.
const getFleet = async () => {
    const result = await pool.query(
        `SELECT
        d.device_id, d.device_name, d.firmware_version,
        d.status AS lifecycle_status, d.shop_id, s.shop_name, s.shop_code,
        u.name AS shopkeeper_name, u.email AS shopkeeper_email,
        d.last_seen_at, d.calibrated_at, d.needs_recalibration,
        r.grams_int AS current_weight_grams,
        r.taken_at  AS current_weight_at,
        (
          SELECT COUNT(*)::int FROM dispense_sessions ds
          WHERE ds.device_id = d.device_id AND ds.opened_at >= NOW() - INTERVAL '24 hours'
        ) AS sessions_last_24h
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
     ORDER BY s.shop_name NULLS FIRST, d.device_id`,
    );

    return result.rows.map((row) => ({
        device_id: row.device_id,
        device_name: row.device_name,
        firmware_version: row.firmware_version,
        shop_id: row.shop_id,
        shop_name: row.shop_name,
        shop_code: row.shop_code,
        shopkeeper_name: row.shopkeeper_name,
        shopkeeper_email: row.shopkeeper_email,
        lifecycle_status: row.lifecycle_status, // active | revoked | inactive (registry status, unrelated to connectivity)
        status: deriveStatus(row.device_id, row.last_seen_at),
        last_seen_at: row.last_seen_at,
        calibration_age_days: calibrationAgeDays(row.calibrated_at),
        needs_recalibration: row.needs_recalibration,
        current_weight_grams: row.current_weight_grams,
        current_weight_at: row.current_weight_at,
        sessions_last_24h: row.sessions_last_24h,
    }));
};

module.exports = { getFleet, deriveStatus, calibrationAgeDays };
