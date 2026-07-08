/**
 * blockchainHealthService.js
 *
 * Composes a full health snapshot for GET /api/admin/blockchain/health:
 *   - RPC connectivity + contract reachability + wallet/gas (blockchainService)
 *   - Sync lag + last successful anchor (queried directly from `transactions`)
 *   - Recent failure rate (blockchainService's in-memory outcome tracker)
 * ...then applies the named thresholds from config/blockchainHealth.js to
 * derive one three-state status (healthy / degraded / down) with the
 * concrete reasons behind it.
 *
 * Read-only: this never writes to `transactions` or touches dispense logic.
 * Results are cached for HEALTH_CACHE_TTL_MS to avoid hitting a rate-limited
 * public Sepolia RPC on every dashboard refresh.
 */
const pool = require("../config/db");
const logger = require("../config/logger");
const blockchainService = require("./blockchainService");
const {
    HEALTH_CACHE_TTL_MS,
    PENDING_ANCHOR_WARN_THRESHOLD,
    PENDING_ANCHOR_CRITICAL_THRESHOLD,
    PENDING_ANCHOR_GRACE_PERIOD_MINUTES,
    FAILURE_RATE_WINDOW_MS,
    FAILURE_RATE_WARN_PCT,
    FAILURE_RATE_CRITICAL_PCT,
    FAILURE_RATE_MIN_SAMPLE,
    ESTIMATED_GAS_PER_TX,
    FALLBACK_GAS_PRICE_GWEI,
    LOW_BALANCE_WARN_TX_COUNT,
    LOW_BALANCE_CRITICAL_TX_COUNT,
} = require("../config/blockchainHealth");

const STATUS = { HEALTHY: "healthy", DEGRADED: "degraded", DOWN: "down" };

let _cache = { value: null, expiresAt: 0 };

async function _getSyncLag() {
    // Single round trip: one row per window/bucket combination.
    const { rows } = await pool.query(
        `SELECT
       COUNT(*) FILTER (WHERE created_at >= now() - interval '1 hour' AND blockchain_tx_hash IS NULL) AS pending_1h,
       COUNT(*) FILTER (
         WHERE created_at >= now() - interval '1 hour'
           AND created_at <= now() - make_interval(mins => $1::int)
           AND blockchain_tx_hash IS NULL
       ) AS pending_1h_concerning,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '1 hour' AND blockchain_tx_hash IS NOT NULL) AS confirmed_1h,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND blockchain_tx_hash IS NULL) AS pending_24h,
       COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND blockchain_tx_hash IS NOT NULL) AS confirmed_24h
     FROM transactions`,
        [PENDING_ANCHOR_GRACE_PERIOD_MINUTES]
    );

    const row = rows[0];
    return {
        lastHour: {
            pending: Number(row.pending_1h),
            pendingConcerning: Number(row.pending_1h_concerning),
            confirmed: Number(row.confirmed_1h),
        },
        last24Hours: {
            pending: Number(row.pending_24h),
            confirmed: Number(row.confirmed_24h),
        },
    };
}

async function _getLastSuccessfulAnchor() {
    // No `anchored_at` column exists (and this feature must not change the
    // schema), so this is the most recently *dispensed* transaction that has
    // since received a hash — an approximation of "last successful anchor",
    // not necessarily the one whose confirmation landed last in wall-clock
    // time if two dispenses confirm out of creation order.
    const { rows } = await pool.query(
        `SELECT blockchain_tx_hash, created_at FROM transactions
     WHERE blockchain_tx_hash IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`
    );

    if (rows.length === 0) return null;
    return { txHash: rows[0].blockchain_tx_hash, at: rows[0].created_at };
}

function _evaluateWallet(wallet) {
    if (wallet.error || wallet.balanceEth == null) {
        return { ...wallet, estimatedTxRemaining: null, lowBalanceWarn: false, lowBalanceCritical: false };
    }

    const gasPriceGwei = wallet.gasPriceGwei != null ? Number(wallet.gasPriceGwei) : FALLBACK_GAS_PRICE_GWEI;
    const costPerTxEth = (gasPriceGwei * ESTIMATED_GAS_PER_TX) / 1e9;
    const estimatedTxRemaining = costPerTxEth > 0 ? Math.floor(Number(wallet.balanceEth) / costPerTxEth) : null;

    return {
        ...wallet,
        estimatedTxRemaining,
        usedFallbackGasPrice: wallet.gasPriceGwei == null,
        lowBalanceWarn: estimatedTxRemaining != null && estimatedTxRemaining < LOW_BALANCE_WARN_TX_COUNT,
        lowBalanceCritical: estimatedTxRemaining != null && estimatedTxRemaining < LOW_BALANCE_CRITICAL_TX_COUNT,
    };
}

function _deriveStatus({ rpc, contract, wallet, syncLag, failureRate }) {
    const reasons = [];
    let status = STATUS.HEALTHY;

    const escalate = (level, reason) => {
        reasons.push(reason);
        if (level === STATUS.DOWN) status = STATUS.DOWN;
        else if (level === STATUS.DEGRADED && status !== STATUS.DOWN) status = STATUS.DEGRADED;
    };

    if (!rpc.reachable) escalate(STATUS.DOWN, `RPC endpoint unreachable: ${rpc.error}`);
    if (!contract.reachable) escalate(STATUS.DOWN, `Contract call (getTotalRecords) failed: ${contract.error}`);

    const hasEnoughSample = failureRate.attempts >= FAILURE_RATE_MIN_SAMPLE;
    if (hasEnoughSample && failureRate.percentage >= FAILURE_RATE_CRITICAL_PCT) {
        escalate(STATUS.DOWN, `Failure rate ${failureRate.percentage.toFixed(1)}% over the last hour (>= ${FAILURE_RATE_CRITICAL_PCT}% critical threshold)`);
    } else if (hasEnoughSample && failureRate.percentage >= FAILURE_RATE_WARN_PCT) {
        escalate(STATUS.DEGRADED, `Failure rate ${failureRate.percentage.toFixed(1)}% over the last hour (>= ${FAILURE_RATE_WARN_PCT}% warn threshold)`);
    }

    const pending = syncLag.lastHour.pendingConcerning;
    if (pending >= PENDING_ANCHOR_CRITICAL_THRESHOLD) {
        escalate(STATUS.DOWN, `${pending} dispenses pending anchor for over ${PENDING_ANCHOR_GRACE_PERIOD_MINUTES}min in the last hour (>= ${PENDING_ANCHOR_CRITICAL_THRESHOLD} critical threshold)`);
    } else if (pending >= PENDING_ANCHOR_WARN_THRESHOLD) {
        escalate(STATUS.DEGRADED, `${pending} dispenses pending anchor for over ${PENDING_ANCHOR_GRACE_PERIOD_MINUTES}min in the last hour (>= ${PENDING_ANCHOR_WARN_THRESHOLD} warn threshold)`);
    }

    if (wallet.lowBalanceCritical) {
        escalate(STATUS.DOWN, `Deployer wallet balance covers only ~${wallet.estimatedTxRemaining} more transactions (< ${LOW_BALANCE_CRITICAL_TX_COUNT} critical threshold)`);
    } else if (wallet.lowBalanceWarn) {
        escalate(STATUS.DEGRADED, `Deployer wallet balance covers only ~${wallet.estimatedTxRemaining} more transactions (< ${LOW_BALANCE_WARN_TX_COUNT} warn threshold)`);
    }

    return { status, reasons };
}

async function _computeSnapshot() {
    const [diagnostics, syncLag, lastSuccessfulAnchor] = await Promise.all([
        blockchainService.getBlockchainDiagnostics(),
        _getSyncLag(),
        _getLastSuccessfulAnchor(),
    ]);

    const failureRate = {
        windowMs: FAILURE_RATE_WINDOW_MS,
        sampleTooSmall: false,
        note: "Tracked in-memory since the last backend restart/deploy — does not include history from before this feature.",
        ...blockchainService.getFailureRateStats(FAILURE_RATE_WINDOW_MS),
    };
    failureRate.sampleTooSmall = failureRate.attempts < FAILURE_RATE_MIN_SAMPLE;

    const wallet = _evaluateWallet(diagnostics.wallet);
    const { status, reasons } = _deriveStatus({ rpc: diagnostics.rpc, contract: diagnostics.contract, wallet, syncLag, failureRate });

    return {
        status,
        reasons,
        checkedAt: new Date().toISOString(),
        rpc: diagnostics.rpc,
        contract: diagnostics.contract,
        wallet,
        syncLag,
        failureRate,
        lastSuccessfulAnchor,
        thresholds: {
            pendingAnchorWarn: PENDING_ANCHOR_WARN_THRESHOLD,
            pendingAnchorCritical: PENDING_ANCHOR_CRITICAL_THRESHOLD,
            pendingAnchorGracePeriodMinutes: PENDING_ANCHOR_GRACE_PERIOD_MINUTES,
            failureRateWarnPct: FAILURE_RATE_WARN_PCT,
            failureRateCriticalPct: FAILURE_RATE_CRITICAL_PCT,
            lowBalanceWarnTxCount: LOW_BALANCE_WARN_TX_COUNT,
            lowBalanceCriticalTxCount: LOW_BALANCE_CRITICAL_TX_COUNT,
        },
    };
}

/**
 * Returns the cached snapshot if fresh, otherwise recomputes it.
 * @param {object} [opts]
 * @param {boolean} [opts.forceRefresh] - bypass the cache (manual refresh action)
 */
async function getHealth({ forceRefresh = false } = {}) {
    const now = Date.now();

    if (!forceRefresh && _cache.value && now < _cache.expiresAt) {
        return { ..._cache.value, cache: { cached: true, ageMs: now - (_cache.expiresAt - HEALTH_CACHE_TTL_MS), ttlMs: HEALTH_CACHE_TTL_MS } };
    }

    try {
        const snapshot = await _computeSnapshot();
        _cache = { value: snapshot, expiresAt: now + HEALTH_CACHE_TTL_MS };
        return { ...snapshot, cache: { cached: false, ageMs: 0, ttlMs: HEALTH_CACHE_TTL_MS } };
    } catch (err) {
        logger.error("[BlockchainHealth] Failed to compute health snapshot", { error: err.message });
        // Serve stale data rather than a hard failure if we have any —
        // an admin dashboard should degrade gracefully, not error out.
        if (_cache.value) {
            return { ..._cache.value, stale: true, cache: { cached: true, ageMs: now - (_cache.expiresAt - HEALTH_CACHE_TTL_MS), ttlMs: HEALTH_CACHE_TTL_MS } };
        }
        throw err;
    }
}

module.exports = { getHealth, STATUS };
