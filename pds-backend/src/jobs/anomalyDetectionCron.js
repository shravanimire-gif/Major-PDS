/**
 * anomalyDetectionCron.js
 *
 * Minimal seed anomaly detector. No anomaly-detection module existed before
 * this (see config/anomalyDetection.js's header) — this is intentionally
 * small: two rule-based checks that INSERT into anomaly_events, feeding the
 * new activity feed. It only reads `transactions`/`shops` and writes to the
 * new `anomaly_events` table; it never touches dispense/wallet/blockchain
 * logic or code paths.
 *
 * Idempotent by design: each run re-scans a window wide enough to cover a
 * missed cycle, and every INSERT is guarded by a NOT EXISTS check so re-runs
 * never duplicate a flag.
 */
const cron = require("node-cron");
const pool = require("../config/db");
const logger = require("../config/logger");
const {
    DETECTION_INTERVAL_MINUTES,
    LARGE_TRANSACTION_WARNING_KG,
    LARGE_TRANSACTION_CRITICAL_KG,
    SHOP_SPIKE_LOOKBACK_DAYS,
    SHOP_SPIKE_MULTIPLIER,
    SHOP_SPIKE_MIN_BASELINE_KG,
    SHOP_SPIKE_DEDUPE_HOURS,
} = require("../config/anomalyDetection");

// Rule A: a single dispense far larger than a normal transaction.
async function _detectLargeTransactions() {
    const { rowCount } = await pool.query(
        `INSERT INTO anomaly_events (type, severity, shop_code, transaction_id, description)
     SELECT
       'large_transaction',
       CASE WHEN (t.rice_qty_kg + t.wheat_qty_kg) >= $2 THEN 'critical' ELSE 'warning' END,
       s.shop_code,
       t.id,
       format(
         'Single dispense of %s kg (rice %s, wheat %s) at %s exceeds the %s kg threshold',
         (t.rice_qty_kg + t.wheat_qty_kg)::numeric(10,2),
         -- $1::numeric, not $1::text: $1 is also compared against a numeric
         -- sum in the WHERE below, and PostgreSQL infers a single type per
         -- parameter. Casting it to text here made that comparison
         -- "numeric >= text", so this rule threw on every run and no
         -- large_transaction anomaly was ever recorded. format('%s') renders
         -- the numeric fine.
         t.rice_qty_kg, t.wheat_qty_kg, s.shop_name, $1::numeric
       )
     FROM transactions t
     JOIN shops s ON s.id = t.shop_id
     WHERE t.created_at >= NOW() - interval '2 hours'
       AND (t.rice_qty_kg + t.wheat_qty_kg) >= $1
       AND NOT EXISTS (
         SELECT 1 FROM anomaly_events ae
         WHERE ae.transaction_id = t.id AND ae.type = 'large_transaction'
       )`,
        [LARGE_TRANSACTION_WARNING_KG, LARGE_TRANSACTION_CRITICAL_KG]
    );
    return rowCount;
}

// Rule B: a shop's last-24h total is an outsized multiple of its own
// trailing baseline — a different signal than rule A (pattern, not a
// single outlier transaction).
async function _detectShopSpikes() {
    const { rowCount } = await pool.query(
        `WITH last_24h AS (
       SELECT s.shop_code, s.shop_name,
         SUM(t.rice_qty_kg + t.wheat_qty_kg) AS total_kg
       FROM transactions t
       JOIN shops s ON s.id = t.shop_id
       WHERE t.created_at >= NOW() - interval '24 hours'
       GROUP BY s.shop_code, s.shop_name
     ),
     baseline AS (
       SELECT s.shop_code,
         SUM(t.rice_qty_kg + t.wheat_qty_kg) / $1::numeric AS avg_daily_kg
       FROM transactions t
       JOIN shops s ON s.id = t.shop_id
       WHERE t.created_at >= NOW() - make_interval(days => $1::int) - interval '24 hours'
         AND t.created_at < NOW() - interval '24 hours'
       GROUP BY s.shop_code
     )
     INSERT INTO anomaly_events (type, severity, shop_code, transaction_id, description)
     SELECT
       'shop_spike',
       'warning',
       l.shop_code,
       NULL,
       format(
         '%s dispensed %s kg in the last 24h, %sx its trailing %s-day daily average of %s kg',
         l.shop_name, l.total_kg::numeric(10,2),
         (l.total_kg / NULLIF(b.avg_daily_kg, 0))::numeric(10,1),
         $1::text, b.avg_daily_kg::numeric(10,2)
       )
     FROM last_24h l
     JOIN baseline b ON b.shop_code = l.shop_code
     WHERE b.avg_daily_kg >= $2
       AND l.total_kg >= b.avg_daily_kg * $3
       AND NOT EXISTS (
         SELECT 1 FROM anomaly_events ae
         WHERE ae.shop_code = l.shop_code AND ae.type = 'shop_spike'
           AND ae.created_at >= NOW() - make_interval(hours => $4::int)
       )`,
        [SHOP_SPIKE_LOOKBACK_DAYS, SHOP_SPIKE_MIN_BASELINE_KG, SHOP_SPIKE_MULTIPLIER, SHOP_SPIKE_DEDUPE_HOURS]
    );
    return rowCount;
}

async function runAnomalyDetection() {
    const [largeTransactions, shopSpikes] = await Promise.all([
        _detectLargeTransactions(),
        _detectShopSpikes(),
    ]);
    return { largeTransactions, shopSpikes };
}

const startAnomalyDetectionCron = () => {
    cron.schedule(`*/${DETECTION_INTERVAL_MINUTES} * * * *`, async () => {
        try {
            const result = await runAnomalyDetection();
            if (result.largeTransactions || result.shopSpikes) {
                logger.info("[AnomalyDetection] New anomalies flagged", result);
            }
        } catch (err) {
            logger.error("[AnomalyDetection] Detection run failed", { error: err.message });
        }
    });

    logger.info(`[AnomalyDetection] Scheduled — runs every ${DETECTION_INTERVAL_MINUTES} minutes`);
};

module.exports = { startAnomalyDetectionCron, runAnomalyDetection };
