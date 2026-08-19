const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const logger = require("../config/logger");
const { LAST_SEEN_TOUCH_INTERVAL_MS } = require("../config/iot");

const TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 10;

const generateToken = () => crypto.randomBytes(TOKEN_BYTES).toString("hex");

const hashToken = (rawToken) => bcrypt.hash(rawToken, BCRYPT_ROUNDS);

// Validates a device's bearer token against iot_devices. Returns a
// discriminated result rather than throwing, so callers (the WS upgrade
// handler and tests) can branch/assert on *why* a token was rejected.
const validateToken = async (deviceId, rawToken) => {
    if (!deviceId || !rawToken) {
        return { ok: false, reason: "invalid_token" };
    }

    const result = await pool.query(
        `SELECT id, device_id, device_token_hash, shop_id, status, token_expires_at,
            previous_token_hash, previous_token_expires_at
     FROM iot_devices
     WHERE device_id = $1`,
        [deviceId],
    );

    if (result.rows.length === 0) {
        return { ok: false, reason: "unknown" };
    }

    const device = result.rows[0];

    if (device.status === "revoked") {
        return { ok: false, reason: "revoked" };
    }

    if (device.status !== "active") {
        return { ok: false, reason: "inactive" };
    }

    // An unassigned device (admin used "Unassign", migration 026 made shop_id
    // nullable) is registered but inert. Rejected here, at the handshake,
    // rather than later per-reading: every downstream consumer — the live
    // reading bus, sensor_readings, session attach, the commit's
    // device.shop_id === session.shop_id invariant — is keyed on a real shop,
    // and none of them has a meaningful answer for NULL.
    if (!device.shop_id) {
        return { ok: false, reason: "unassigned" };
    }

    if (device.token_expires_at && new Date(device.token_expires_at).getTime() <= Date.now()) {
        return { ok: false, reason: "expired" };
    }

    const matches = await bcrypt.compare(rawToken, device.device_token_hash);
    if (matches) {
        return { ok: true, device };
    }

    // Grace window (Phase 3): a just-rotated token's *previous* hash still
    // authenticates for a short while, so a device mid-reconnect-backoff
    // with the old token isn't hard-locked out the instant an admin rotates
    // it — see config/iot.js's TOKEN_ROTATION_GRACE_MS.
    const graceStillOpen =
        device.previous_token_hash &&
        device.previous_token_expires_at &&
        new Date(device.previous_token_expires_at).getTime() > Date.now();

    if (graceStillOpen) {
        const matchesPrevious = await bcrypt.compare(rawToken, device.previous_token_hash);
        if (matchesPrevious) {
            return { ok: true, device };
        }
    }

    return { ok: false, reason: "invalid_token" };
};

const touchLastSeen = async (deviceId) => {
    await pool.query(
        `UPDATE iot_devices SET last_seen_at = NOW() WHERE device_id = $1`,
        [deviceId],
    );
};

// last_seen_at is what the Admin Panel turns into ONLINE/OFFLINE once the live
// WebSocket is gone (deviceFleetService.deriveStatus), so it has to keep
// advancing while a device is streaming — not just record the moment it
// connected. Without this, a bridge that ran for an hour and then died looked
// "offline since an hour ago" the instant it dropped, and a backend restart
// made every genuinely-connected device look stale.
//
// Throttled in memory rather than written per reading: the ESP32 samples at
// 10 Hz, and an UPDATE per sample would be ~864k pointless row versions a day
// per device for a field whose consumer tolerates minutes of staleness.
const lastTouchedAtByDevice = new Map();

const touchLastSeenThrottled = (deviceId) => {
    const now = Date.now();
    const previous = lastTouchedAtByDevice.get(deviceId) || 0;
    if (now - previous < LAST_SEEN_TOUCH_INTERVAL_MS) {
        return false;
    }
    lastTouchedAtByDevice.set(deviceId, now);
    touchLastSeen(deviceId).catch((err) =>
        logger.error("[IoT] Throttled last_seen_at update failed", { deviceId, message: err.message }),
    );
    return true;
};

// Test/diagnostic helper — lets a suite exercise the throttle deterministically
// instead of waiting out LAST_SEEN_TOUCH_INTERVAL_MS.
const _resetLastSeenThrottle = (deviceId) => {
    if (deviceId === undefined) {
        lastTouchedAtByDevice.clear();
    } else {
        lastTouchedAtByDevice.delete(deviceId);
    }
};

// Records the firmware version a device reports in its serial `hello` frame
// (relayed by the IoT bridge at connect time). Device-reported, never
// admin-supplied, so iot_devices.firmware_version always describes the binary
// actually running on the board. Written with a no-op guard so a reconnecting
// device that reports the same version doesn't churn the row.
const recordFirmwareVersion = async (deviceId, firmwareVersion) => {
    if (!firmwareVersion) return false;
    const result = await pool.query(
        `UPDATE iot_devices
        SET firmware_version = $1
      WHERE device_id = $2
        AND (firmware_version IS DISTINCT FROM $1)
      RETURNING device_id`,
        [String(firmwareVersion).slice(0, 50), deviceId],
    );
    return result.rows.length > 0;
};

module.exports = {
    generateToken,
    hashToken,
    validateToken,
    touchLastSeen,
    touchLastSeenThrottled,
    recordFirmwareVersion,
    _resetLastSeenThrottle,
};
