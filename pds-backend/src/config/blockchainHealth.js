/**
 * blockchainHealth.js
 *
 * Named thresholds for the /api/admin/blockchain/health endpoint. Centralised
 * here (rather than scattered as magic numbers in blockchainHealthService.js)
 * so they're easy to find and tune without touching logic.
 *
 * See the Phase implementation summary for the reasoning behind each default.
 */
module.exports = {
    // How long a computed health snapshot is reused before the endpoint
    // re-hits the RPC/contract/DB. Keeps dashboard polling from hammering a
    // rate-limited public Sepolia RPC.
    HEALTH_CACHE_TTL_MS: 45_000, // 45s

    // "Sync lag" — dispenses whose blockchain_tx_hash is still NULL.
    // Evaluated over the last 1 hour (the 24h count is reported for context
    // but does not by itself move the status, since it accumulates and is
    // less useful as an "is something wrong right now" signal).
    PENDING_ANCHOR_WARN_THRESHOLD: 5, // >= this many pending in the last hour -> degraded
    PENDING_ANCHOR_CRITICAL_THRESHOLD: 20, // >= this many pending in the last hour -> down

    // recordDispense() awaits tx.wait(1) before the hash is written back, so
    // a brand-new dispense is *expected* to show NULL for a short while even
    // when everything is healthy (Sepolia block time + RPC latency). A
    // pending row younger than this grace period is still shown in the raw
    // counts but excluded from the amber/red evaluation above, so a burst of
    // shop activity doesn't false-positive the status.
    PENDING_ANCHOR_GRACE_PERIOD_MINUTES: 5,

    // Recent failure rate — recordDispense() calls that resolved
    // { success: false }, tracked in an in-memory ring buffer (see the
    // "new logging" note in blockchainService.js) over a 1h window, matching
    // the pending-anchor window so the two numbers tell one coherent story
    // ("in the last hour: N attempted, X% failed, Y still pending").
    FAILURE_RATE_WINDOW_MS: 60 * 60 * 1000, // 1h
    FAILURE_RATE_WARN_PCT: 5, // >= 5% failed -> degraded
    FAILURE_RATE_CRITICAL_PCT: 20, // >= 20% failed -> down
    // Don't let percentage thresholds fire on a tiny sample (e.g. 1 failure
    // out of 1 attempt = 100%, but meaningless on a quiet system).
    FAILURE_RATE_MIN_SAMPLE: 3,

    // Wallet / gas. Expressed as "how many more transactions can this wallet
    // afford at the current gas price" rather than a raw ETH figure, per the
    // request — more meaningful to an admin than a bare balance number.
    // Gas price is read live from the RPC (eth_feeData); this is only the
    // fallback used if that call fails.
    ESTIMATED_GAS_PER_TX: 150_000, // generous estimate for recordTransaction()'s 6-arg storage write
    FALLBACK_GAS_PRICE_GWEI: 2, // typical low Sepolia gas price, used only if getFeeData() errors
    LOW_BALANCE_WARN_TX_COUNT: 50, // balance covers fewer than this many more txs -> degraded
    LOW_BALANCE_CRITICAL_TX_COUNT: 10, // balance covers fewer than this many more txs -> down (can't sustain operations)
};
