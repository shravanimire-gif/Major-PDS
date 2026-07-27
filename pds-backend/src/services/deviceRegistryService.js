const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

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

module.exports = { generateToken, hashToken, validateToken, touchLastSeen };
