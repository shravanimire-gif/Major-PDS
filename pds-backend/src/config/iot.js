/**
 * iot.js
 *
 * Named thresholds for the IoT weighing subsystem. Centralised here (mirrors
 * blockchainHealth.js's pattern) rather than scattered as magic numbers in
 * iotController.js/iotSocketServer.js.
 */
module.exports = {
    // Sanity ceiling for a 5kg load cell + tolerance. A reading above this
    // (or negative) is rejected as a bad frame, not persisted.
    MIN_VALID_GRAMS: 0,
    MAX_VALID_GRAMS: 10000,

    // Phase 2 — a device that racks up this many rejected (out-of-range)
    // readings within this rolling window is flagged needs_recalibration.
    RECALIBRATION_REJECT_THRESHOLD: 3,
    RECALIBRATION_REJECT_WINDOW_MS: 60_000,

    // Phase 2 — auto-confirm stability rule (stabilityDetectorService.js).
    // Window must contain at least this many readings...
    STABILITY_MIN_READINGS: 15,
    // ...spanning at most this window...
    STABILITY_WINDOW_MS: 3_000,
    // ...with a max-min spread no more than this...
    STABILITY_MAX_SPREAD_GRAMS: 5,

    // Phase 2 — once the stability rule first holds, how long the
    // "confirming" countdown runs before committing (cancelled if the rule
    // breaks before this elapses).
    CONFIRM_COUNTDOWN_MS: 3_000,

    // Phase 3 — device fleet "stale" threshold: no live WS connection, but
    // last_seen_at is more recent than this -> likely mid-reconnect rather
    // than genuinely offline.
    DEVICE_STALE_THRESHOLD_MS: 2 * 60 * 1000,

    // Phase 3 — a rotated device token keeps working for this long
    // afterward, so a device already mid-reconnect-backoff with the old
    // token isn't hard-locked out the instant an admin rotates it.
    TOKEN_ROTATION_GRACE_MS: 5 * 60 * 1000,

    // Phase 3 — per-IP rate limit on /ws/iot connection *attempts*
    // (upgrade requests), separate from express-rate-limit since that
    // middleware can't run on a raw http.Server 'upgrade' event.
    WS_UPGRADE_RATE_LIMIT_WINDOW_MS: 60 * 1000,
    WS_UPGRADE_RATE_LIMIT_MAX: 20,

    // Phase 3 — how often the streaming anomaly-rules engine runs.
    ANOMALY_RULES_INTERVAL_MINUTES: 5,
};
