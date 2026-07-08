/**
 * anomalyDetection.js
 *
 * Named thresholds for the minimal seed anomaly detector (see
 * src/jobs/anomalyDetectionCron.js). No anomaly-detection module existed in
 * this codebase before — the only prior art was a single hard-coded ">50kg"
 * check inside adminController.getIntegrityChecks, computed on demand and
 * never persisted. These two rules are a deliberately small starting point
 * (matching that existing threshold plus one shop-level pattern) to give the
 * activity feed real data to show, not a general-purpose fraud engine.
 */
module.exports = {
    // How often the cron scans recent transactions for new anomalies.
    DETECTION_INTERVAL_MINUTES: 5,

    // Rule A — single dispense far larger than a normal transaction.
    // WARNING threshold matches the pre-existing ">50kg" check in
    // getIntegrityChecks (kept consistent with that existing, tested rule).
    LARGE_TRANSACTION_WARNING_KG: 50,
    LARGE_TRANSACTION_CRITICAL_KG: 100,

    // Rule B — a shop's total dispensed quantity in the last 24h is an
    // outsized multiple of its own trailing baseline (diversion-pattern
    // signal, distinct from rule A's single-transaction signal).
    SHOP_SPIKE_LOOKBACK_DAYS: 30,
    SHOP_SPIKE_MULTIPLIER: 3,
    // Ignore shops whose baseline average is too small for a multiplier to
    // be meaningful (a shop going from 0.5kg/day to 2kg/day isn't a signal).
    SHOP_SPIKE_MIN_BASELINE_KG: 5,
    // Only re-flag a shop once per rolling day, not every detection cycle
    // while the spike condition persists.
    SHOP_SPIKE_DEDUPE_HOURS: 24,
};
