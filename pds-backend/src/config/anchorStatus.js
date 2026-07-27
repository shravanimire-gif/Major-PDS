/**
 * anchorStatus.js
 *
 * Named thresholds for GET /api/admin/iot/anchor-status's pill colour,
 * mirroring config/blockchainHealth.js's pattern (centralized, tunable
 * without touching service logic).
 */
module.exports = {
    PENDING_COUNT_AMBER_THRESHOLD: 50,
    OLDEST_PENDING_AMBER_MINUTES: 10,
    OLDEST_PENDING_RED_MINUTES: 60,
};
