const pool = require("../config/db");
const {
    PENDING_COUNT_AMBER_THRESHOLD,
    OLDEST_PENDING_AMBER_MINUTES,
    OLDEST_PENDING_RED_MINUTES,
} = require("../config/anchorStatus");

// GET /api/admin/iot/anchor-status — never blocks/affects anything, purely
// diagnostic (same philosophy as blockchainHealthService.js's existing
// getBlockchainDiagnostics, just scoped to dispense_records specifically).
const getAnchorStatus = async () => {
    const pendingResult = await pool.query(
        `SELECT COUNT(*)::int AS pending_count, MIN(committed_at) AS oldest_pending_at
     FROM dispense_records WHERE blockchain_tx_hash IS NULL`,
    );
    const lastSuccessResult = await pool.query(
        `SELECT MAX(committed_at) AS last_success_at
     FROM dispense_records WHERE blockchain_tx_hash IS NOT NULL`,
    );
    const lastFailureResult = await pool.query(
        `SELECT last_anchor_error FROM dispense_records
     WHERE blockchain_tx_hash IS NULL AND last_anchor_error IS NOT NULL
     ORDER BY committed_at DESC LIMIT 1`,
    );

    const pendingCount = pendingResult.rows[0].pending_count;
    const oldestPendingAt = pendingResult.rows[0].oldest_pending_at;
    const oldestPendingAgeMs = oldestPendingAt ? Date.now() - new Date(oldestPendingAt).getTime() : 0;
    const oldestPendingMinutes = oldestPendingAgeMs / 60_000;

    let level = "ok";
    if (oldestPendingMinutes > OLDEST_PENDING_RED_MINUTES) {
        level = "red";
    } else if (pendingCount > PENDING_COUNT_AMBER_THRESHOLD || oldestPendingMinutes > OLDEST_PENDING_AMBER_MINUTES) {
        level = "amber";
    }

    return {
        pending_count: pendingCount,
        oldest_pending_age_seconds: Math.round(oldestPendingAgeMs / 1000),
        last_success_at: lastSuccessResult.rows[0].last_success_at,
        last_failure_reason: lastFailureResult.rows[0]?.last_anchor_error || null,
        level,
    };
};

module.exports = { getAnchorStatus };
