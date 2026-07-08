/**
 * activityFeedService.js
 *
 * Merges four sources into one reverse-chronological feed for
 * GET /api/admin/activity/feed — never cached (near-real-time), unlike the
 * analytics endpoints:
 *   1. Dispense transactions              (transactions)
 *   2. Blockchain anchor confirmations    (transactions.blockchain_tx_hash)
 *   3. Anomaly flags                      (anomaly_events)
 *   4. Blockchain health status changes   (in-memory, see below)
 *
 * Known limitation (documented, not silently glossed over): transactions
 * has no `anchored_at` column (same gap noted in blockchainHealthService.js
 * for "last successful anchor"), so the blockchain-anchor event uses the
 * dispense's own created_at as its timestamp too — it's an approximation,
 * not the real confirmation time.
 *
 * Health-change detection is in-memory only (compares each poll's status to
 * the last-seen one) and resets on restart — this does NOT modify
 * blockchainHealthService.js in any way; it only calls its existing
 * exported getHealth().
 */
const pool = require("../config/db");
const blockchainHealthService = require("./blockchainHealthService");
const { ACTIVITY_FEED_DEFAULT_LOOKBACK_MS, ACTIVITY_FEED_DEFAULT_LIMIT, ACTIVITY_FEED_MAX_LIMIT } = require("../config/analytics");

let _lastKnownHealthStatus = null;
// Small in-memory ring buffer of health transitions observed while this
// process has been alive — not persisted, matching blockchainHealthService's
// own "resets on restart" philosophy rather than adding a history table for
// a single conditional bullet in the spec.
let _healthEvents = [];
const _HEALTH_EVENT_RETENTION = 50;

async function _checkHealthTransition() {
    let health;
    try {
        health = await blockchainHealthService.getHealth();
    } catch {
        return; // health service itself reports its own down status via other events; don't crash the feed over it
    }

    if (_lastKnownHealthStatus !== null && health.status !== _lastKnownHealthStatus) {
        _healthEvents.push({
            id: `health-${Date.now()}`,
            type: "health_change",
            severity: health.status === "healthy" ? "info" : health.status === "degraded" ? "warning" : "critical",
            timestamp: new Date().toISOString(),
            summary: `Blockchain integration status changed: ${_lastKnownHealthStatus} → ${health.status}`,
            refType: null,
            refId: null,
            detail: { from: _lastKnownHealthStatus, to: health.status, reasons: health.reasons },
        });
        if (_healthEvents.length > _HEALTH_EVENT_RETENTION) _healthEvents.shift();
    }
    _lastKnownHealthStatus = health.status;
}

async function _getDispenseEvents(since, limit) {
    const { rows } = await pool.query(
        `SELECT t.id, t.created_at, t.rice_qty_kg, t.wheat_qty_kg, t.sugar_qty_kg,
            t.blockchain_tx_hash, s.shop_code, s.shop_name, rc.card_number, rc.id AS ration_card_id
     FROM transactions t
     JOIN shops s ON s.id = t.shop_id
     JOIN ration_cards rc ON rc.id = t.ration_card_id
     WHERE t.created_at > $1
     ORDER BY t.created_at DESC
     LIMIT $2`,
        [since, limit]
    );

    return rows.map((r) => ({
        id: `dispense-${r.id}`,
        type: "dispense",
        severity: "info",
        timestamp: r.created_at.toISOString(),
        summary: `Dispensed ${Number(r.rice_qty_kg)}kg rice, ${Number(r.wheat_qty_kg)}kg wheat, ${Number(r.sugar_qty_kg)}kg sugar at ${r.shop_name} (card ${r.card_number})`,
        refType: "transaction",
        refId: r.id,
        detail: {
            transactionId: r.id,
            shopCode: r.shop_code,
            shopName: r.shop_name,
            cardNumber: r.card_number,
            rationCardId: r.ration_card_id,
            riceQtyKg: Number(r.rice_qty_kg),
            wheatQtyKg: Number(r.wheat_qty_kg),
            sugarQtyKg: Number(r.sugar_qty_kg),
            anchored: r.blockchain_tx_hash != null,
        },
    }));
}

async function _getAnchorEvents(since, limit) {
    const { rows } = await pool.query(
        `SELECT t.id, t.created_at, t.blockchain_tx_hash, s.shop_name, rc.card_number
     FROM transactions t
     JOIN shops s ON s.id = t.shop_id
     JOIN ration_cards rc ON rc.id = t.ration_card_id
     WHERE t.blockchain_tx_hash IS NOT NULL AND t.created_at > $1
     ORDER BY t.created_at DESC
     LIMIT $2`,
        [since, limit]
    );

    return rows.map((r) => ({
        id: `anchor-${r.id}`,
        type: "blockchain_anchor",
        severity: "info",
        // Approximation — see file header. No anchored_at column exists.
        timestamp: r.created_at.toISOString(),
        summary: `Blockchain anchor confirmed for dispense at ${r.shop_name} (${r.blockchain_tx_hash.slice(0, 10)}…)`,
        refType: "transaction",
        refId: r.id,
        detail: { transactionId: r.id, txHash: r.blockchain_tx_hash, cardNumber: r.card_number, timestampIsApproximate: true },
    }));
}

async function _getAnomalyEvents(since, limit) {
    const { rows } = await pool.query(
        `SELECT id, type, severity, shop_code, transaction_id, description, created_at, resolved
     FROM anomaly_events
     WHERE created_at > $1
     ORDER BY created_at DESC
     LIMIT $2`,
        [since, limit]
    );

    return rows.map((r) => ({
        id: `anomaly-${r.id}`,
        type: "anomaly",
        severity: r.severity,
        timestamp: r.created_at.toISOString(),
        summary: r.description,
        refType: r.transaction_id ? "transaction" : "shop",
        refId: r.transaction_id || r.shop_code,
        detail: {
            anomalyId: r.id,
            anomalyType: r.type,
            shopCode: r.shop_code,
            transactionId: r.transaction_id,
            resolved: r.resolved,
        },
    }));
}

function _getHealthChangeEvents(since) {
    const sinceMs = new Date(since).getTime();
    return _healthEvents.filter((e) => new Date(e.timestamp).getTime() > sinceMs);
}

/**
 * @param {object} opts
 * @param {string} [opts.since] - ISO timestamp; only events after this are returned. Defaults to a 24h lookback.
 * @param {number} [opts.limit] - max events returned (applies to the merged, sorted result)
 * @param {string} [opts.filter] - 'all' | 'anomalies' | 'blockchain'
 */
async function getActivityFeed({ since, limit, filter = "all" } = {}) {
    const effectiveSince = since || new Date(Date.now() - ACTIVITY_FEED_DEFAULT_LOOKBACK_MS).toISOString();
    const effectiveLimit = Math.min(Number(limit) || ACTIVITY_FEED_DEFAULT_LIMIT, ACTIVITY_FEED_MAX_LIMIT);

    await _checkHealthTransition();

    const wantsDispense = filter === "all";
    const wantsBlockchain = filter === "all" || filter === "blockchain";
    const wantsAnomalies = filter === "all" || filter === "anomalies";

    const [dispenseEvents, anchorEvents, anomalyEvents] = await Promise.all([
        wantsDispense ? _getDispenseEvents(effectiveSince, effectiveLimit) : [],
        wantsBlockchain ? _getAnchorEvents(effectiveSince, effectiveLimit) : [],
        wantsAnomalies ? _getAnomalyEvents(effectiveSince, effectiveLimit) : [],
    ]);
    const healthEvents = wantsBlockchain ? _getHealthChangeEvents(effectiveSince) : [];

    const merged = [...dispenseEvents, ...anchorEvents, ...anomalyEvents, ...healthEvents]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, effectiveLimit);

    const cursor = merged.length > 0 ? merged[0].timestamp : effectiveSince;

    return { events: merged, cursor, filter };
}

module.exports = { getActivityFeed };
