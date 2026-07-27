const pool = require("../config/db");
const logger = require("../config/logger");

const DEFAULT_TIMEZONE = "Asia/Kolkata";

// ---------------------------------------------------------------------
// Pure evaluators — take plain-object fixtures, return candidate flags.
// No DB access in this section at all, so tests/anomalyRules.test.js can
// exercise each one directly with a fixture, per Phase 3's test
// requirement, independent of the DB-integration layer below.
// ---------------------------------------------------------------------

// records: [{shop_id, measured_grams, entitled_grams, tolerance_grams}]
const evaluateNearTolerance = (records, params) => {
    const { edge_margin_grams, min_occurrences } = params;
    const countByShop = new Map();

    for (const r of records) {
        const lowEdge = r.entitled_grams - r.tolerance_grams;
        if (Math.abs(r.measured_grams - lowEdge) <= edge_margin_grams) {
            countByShop.set(r.shop_id, (countByShop.get(r.shop_id) || 0) + 1);
        }
    }

    const flags = [];
    for (const [shopId, count] of countByShop) {
        if (count >= min_occurrences) {
            flags.push({
                shop_id: shopId,
                description: `${count} dispenses landed within ${edge_margin_grams}g of the low tolerance edge in the last ${params.window_days} days`,
            });
        }
    }
    return flags;
};

const getHourInTimezone = (date, timezone) => {
    const d = date instanceof Date ? date : new Date(date);
    const hourString = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
    }).format(d);
    return Number(hourString) % 24;
};

// records: [{id (dispense_record id), shop_id, committed_at}]
// Per-record, not aggregated — each off-hours commit is its own event.
const evaluateOffHours = (records, params) => {
    const timezone = params.timezone || DEFAULT_TIMEZONE;

    return records
        .filter((r) => {
            const hour = getHourInTimezone(r.committed_at, timezone);
            return hour < params.start_hour || hour >= params.end_hour;
        })
        .map((r) => ({
            shop_id: r.shop_id,
            dispense_record_id: r.id,
            description: `Dispense committed at ${getHourInTimezone(r.committed_at, timezone)}:00 ${timezone}, outside ${params.start_hour}:00–${params.end_hour}:00`,
        }));
};

// records: [{shop_id, committed_at}]
const evaluateRapidFire = (records, params) => {
    const { max_commits_per_minute } = params;
    const timestampsByShop = new Map();

    for (const r of records) {
        const list = timestampsByShop.get(r.shop_id) || [];
        list.push(new Date(r.committed_at).getTime());
        timestampsByShop.set(r.shop_id, list);
    }

    const flags = [];
    for (const [shopId, timestampsUnsorted] of timestampsByShop) {
        const timestamps = [...timestampsUnsorted].sort((a, b) => a - b);
        let maxInWindow = 0;

        for (let i = 0; i < timestamps.length; i += 1) {
            let count = 1;
            for (let j = i + 1; j < timestamps.length && timestamps[j] - timestamps[i] <= 60_000; j += 1) {
                count += 1;
            }
            maxInWindow = Math.max(maxInWindow, count);
        }

        if (maxInWindow > max_commits_per_minute) {
            flags.push({
                shop_id: shopId,
                description: `${maxInWindow} commits within a 60s window (limit ${max_commits_per_minute}/min)`,
            });
        }
    }
    return flags;
};

// deviceStats: [{device_id, shop_id, total_readings, rejected_readings}]
const evaluateDeviceAnomaly = (deviceStats, params) => {
    const { reject_pct_threshold } = params;
    const flags = [];

    for (const d of deviceStats) {
        const total = d.total_readings + d.rejected_readings;
        if (total === 0) continue;

        const rejectPct = (d.rejected_readings / total) * 100;
        if (rejectPct > reject_pct_threshold) {
            flags.push({
                shop_id: d.shop_id,
                device_id: d.device_id,
                description: `${rejectPct.toFixed(1)}% of readings rejected (sanity ceiling) in the last ${params.window_hours}h (limit ${reject_pct_threshold}%)`,
            });
        }
    }
    return flags;
};

// ---------------------------------------------------------------------
// DB-integration layer — fetches inputs, calls the pure evaluators above,
// persists anomaly_flags (deduped) and auto-resolves flags whose condition
// no longer holds. Adding a new rule = one row in anomaly_rules (migration)
// + one entry in RULE_EVALUATORS below; no other code changes.
// ---------------------------------------------------------------------

const fetchNearToleranceInputs = async (params) => {
    const result = await pool.query(
        `SELECT shop_id, measured_grams, entitled_grams, tolerance_grams
     FROM dispense_records
     WHERE committed_at >= NOW() - ($1 || ' days')::interval`,
        [params.window_days],
    );
    return result.rows;
};

const fetchOffHoursInputs = async () => {
    // Only records not already flagged for OFF_HOURS — each commit is a
    // one-time event (no auto-resolve concept), so this is the dedup.
    const result = await pool.query(
        `SELECT dr.id, dr.shop_id, dr.committed_at
     FROM dispense_records dr
     WHERE dr.committed_at >= NOW() - INTERVAL '1 day'
       AND NOT EXISTS (
         SELECT 1 FROM anomaly_flags af
         WHERE af.dispense_record_id = dr.id AND af.rule_key = 'OFF_HOURS'
       )`,
    );
    return result.rows;
};

const fetchRapidFireInputs = async () => {
    const result = await pool.query(
        `SELECT shop_id, committed_at FROM dispense_records WHERE committed_at >= NOW() - INTERVAL '10 minutes'`,
    );
    return result.rows;
};

const fetchDeviceAnomalyInputs = async (params) => {
    const result = await pool.query(
        `SELECT
        d.device_id, d.shop_id,
        (SELECT COUNT(*) FROM sensor_readings sr
         WHERE sr.device_id = d.device_id AND sr.taken_at >= NOW() - ($1 || ' hours')::interval)::int AS total_readings,
        (SELECT COUNT(*) FROM sensor_reading_rejections rr
         WHERE rr.device_id = d.device_id AND rr.rejected_at >= NOW() - ($1 || ' hours')::interval)::int AS rejected_readings
     FROM iot_devices d`,
        [params.window_hours],
    );
    return result.rows;
};

const RULE_EVALUATORS = {
    NEAR_TOLERANCE: { evaluate: evaluateNearTolerance, fetchInputs: fetchNearToleranceInputs, aggregate: true },
    OFF_HOURS: { evaluate: evaluateOffHours, fetchInputs: fetchOffHoursInputs, aggregate: false },
    RAPID_FIRE: { evaluate: evaluateRapidFire, fetchInputs: fetchRapidFireInputs, aggregate: true },
    DEVICE_ANOMALY: { evaluate: evaluateDeviceAnomaly, fetchInputs: fetchDeviceAnomalyInputs, aggregate: true },
};

const flagKey = (flag) => `${flag.shop_id}::${flag.device_id || ""}`;

const runRule = async (rule) => {
    const evaluator = RULE_EVALUATORS[rule.rule_key];
    if (!evaluator) {
        logger.warn("[AnomalyRules] No evaluator registered for rule", { ruleKey: rule.rule_key });
        return;
    }

    const inputs = await evaluator.fetchInputs(rule.params_json);
    const candidates = evaluator.evaluate(inputs, rule.params_json);

    if (evaluator.aggregate) {
        const existingResult = await pool.query(
            `SELECT id, shop_id, device_id FROM anomaly_flags
       WHERE rule_key = $1 AND resolved_at IS NULL AND auto_resolved_at IS NULL`,
            [rule.rule_key],
        );
        const existingByKey = new Map(existingResult.rows.map((row) => [flagKey(row), row]));
        const candidateKeys = new Set(candidates.map(flagKey));

        for (const candidate of candidates) {
            if (!existingByKey.has(flagKey(candidate))) {
                await pool.query(
                    `INSERT INTO anomaly_flags (rule_key, shop_id, device_id, severity, description)
           VALUES ($1, $2, $3, $4, $5)`,
                    [rule.rule_key, candidate.shop_id, candidate.device_id || null, rule.severity, candidate.description],
                );
            }
        }

        for (const existing of existingResult.rows) {
            if (!candidateKeys.has(flagKey(existing))) {
                await pool.query(`UPDATE anomaly_flags SET auto_resolved_at = NOW() WHERE id = $1`, [existing.id]);
            }
        }
    } else {
        for (const candidate of candidates) {
            await pool.query(
                `INSERT INTO anomaly_flags (rule_key, shop_id, dispense_record_id, severity, description)
         VALUES ($1, $2, $3, $4, $5)`,
                [rule.rule_key, candidate.shop_id, candidate.dispense_record_id, rule.severity, candidate.description],
            );
        }
    }
};

// Directly callable (not just via the cron wrapper) so tests and the E2E
// seed script can run the whole pipeline deterministically — same pattern
// as entitlementService.runEntitlementAllocation().
const runAnomalyRules = async () => {
    const rulesResult = await pool.query(`SELECT rule_key, severity, params_json FROM anomaly_rules WHERE enabled = true`);

    for (const rule of rulesResult.rows) {
        try {
            await runRule(rule);
        } catch (err) {
            logger.error("[AnomalyRules] Rule run failed", { ruleKey: rule.rule_key, message: err.message });
        }
    }
};

// GET /api/admin/anomalies?severity&resolved&shop_id
const listFlags = async ({ severity, resolved, shopId } = {}) => {
    const conditions = [];
    const params = [];

    if (severity) {
        params.push(severity);
        conditions.push(`af.severity = $${params.length}`);
    }
    if (shopId) {
        params.push(shopId);
        conditions.push(`af.shop_id = $${params.length}`);
    }
    if (resolved === "true") {
        conditions.push(`(af.resolved_at IS NOT NULL OR af.auto_resolved_at IS NOT NULL)`);
    } else if (resolved === "false") {
        conditions.push(`af.resolved_at IS NULL AND af.auto_resolved_at IS NULL`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
        `SELECT af.id, af.rule_key, af.shop_id, s.shop_name, af.device_id, af.dispense_record_id,
            af.severity, af.description, af.created_at, af.resolved_at, af.auto_resolved_at
     FROM anomaly_flags af
     JOIN shops s ON s.id = af.shop_id
     ${whereClause}
     ORDER BY af.created_at DESC
     LIMIT 200`,
        params,
    );
    return result.rows;
};

// POST /api/admin/anomalies/:id/resolve
const resolveFlag = async (id) => {
    const result = await pool.query(
        `UPDATE anomaly_flags SET resolved_at = NOW()
     WHERE id = $1 AND resolved_at IS NULL AND auto_resolved_at IS NULL
     RETURNING id, rule_key, shop_id`,
        [id],
    );
    return result.rows[0] || null;
};

module.exports = {
    runAnomalyRules,
    listFlags,
    resolveFlag,
    // exported for tests/anomalyRules.test.js's pure-fixture tests
    evaluateNearTolerance,
    evaluateOffHours,
    evaluateRapidFire,
    evaluateDeviceAnomaly,
};
