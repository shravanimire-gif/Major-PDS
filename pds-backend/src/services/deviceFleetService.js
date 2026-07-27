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
const getFleet = async () => {
    const result = await pool.query(
        `SELECT
        d.device_id, d.status AS lifecycle_status, d.shop_id, s.shop_name, s.shop_code,
        d.last_seen_at, d.calibrated_at, d.needs_recalibration,
        (
          SELECT COUNT(*)::int FROM dispense_sessions ds
          WHERE ds.device_id = d.device_id AND ds.opened_at >= NOW() - INTERVAL '24 hours'
        ) AS sessions_last_24h
     FROM iot_devices d
     JOIN shops s ON s.id = d.shop_id
     ORDER BY s.shop_name, d.device_id`,
    );

    return result.rows.map((row) => ({
        device_id: row.device_id,
        shop_id: row.shop_id,
        shop_name: row.shop_name,
        shop_code: row.shop_code,
        lifecycle_status: row.lifecycle_status, // active | revoked | inactive (registry status, unrelated to connectivity)
        status: deriveStatus(row.device_id, row.last_seen_at),
        last_seen_at: row.last_seen_at,
        calibration_age_days: calibrationAgeDays(row.calibrated_at),
        needs_recalibration: row.needs_recalibration,
        sessions_last_24h: row.sessions_last_24h,
    }));
};

module.exports = { getFleet, deriveStatus, calibrationAgeDays };
