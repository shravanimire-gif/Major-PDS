/**
 * analyticsService.js
 *
 * Read-only aggregate queries backing GET /api/admin/analytics/*. Every
 * query here is additive read logic — nothing writes to transactions,
 * wallets, ration_cards, or shops.
 *
 * Results are cached per distinct parameter combination for
 * ANALYTICS_CACHE_TTL_MS to avoid re-running aggregate queries on every
 * dashboard render (see config/analytics.js).
 */
const pool = require("../config/db");
const { ANALYTICS_CACHE_TTL_MS, VALID_RANGES, RANGE_TO_DAYS, DEFAULT_RANGE } = require("../config/analytics");

const _cache = new Map(); // key -> { value, expiresAt }

async function _cached(key, compute) {
    const now = Date.now();
    const hit = _cache.get(key);
    if (hit && now < hit.expiresAt) return hit.value;

    const value = await compute();
    _cache.set(key, { value, expiresAt: now + ANALYTICS_CACHE_TTL_MS });
    return value;
}

function _normalizeRange(range) {
    return VALID_RANGES.includes(range) ? range : DEFAULT_RANGE;
}

/**
 * Daily rice/wheat totals for the requested range, with zero-filled
 * gaps for days with no dispenses (so a line/area chart doesn't skip days).
 */
async function getDistributionTrend(range) {
    const normalizedRange = _normalizeRange(range);
    const days = RANGE_TO_DAYS[normalizedRange];

    return _cached(`distribution-trend:${normalizedRange}`, async () => {
        const { rows } = await pool.query(
            `WITH daily AS (
         SELECT date_trunc('day', created_at)::date AS day,
                SUM(rice_qty_kg) AS rice_kg,
                SUM(wheat_qty_kg) AS wheat_kg
         FROM transactions
         WHERE created_at >= date_trunc('day', NOW()) - make_interval(days => $1::int)
         GROUP BY 1
       )
       SELECT
         d::date AS day,
         COALESCE(daily.rice_kg, 0)::float AS rice_kg,
         COALESCE(daily.wheat_kg, 0)::float AS wheat_kg
       FROM generate_series(
         date_trunc('day', NOW()) - make_interval(days => $1::int),
         date_trunc('day', NOW()),
         interval '1 day'
       ) AS d
       LEFT JOIN daily ON daily.day = d::date
       ORDER BY d`,
            [days]
        );

        return {
            range: normalizedRange,
            days: rows.map((r) => ({
                date: r.day.toISOString().slice(0, 10),
                rice_kg: r.rice_kg,
                wheat_kg: r.wheat_kg,
            })),
        };
    });
}

/**
 * Per-shop or per-district: total entitled quantity vs. total actually
 * dispensed over the range, sorted by |gap| descending (both under- and
 * over-dispensing are candidates worth an admin's attention).
 *
 * Entitlement is fundamentally a monthly figure (policies.*_per_card_grams,
 * replenished monthly by entitlementService/entitlementCron). To compare it
 * against an arbitrary N-day window, the monthly entitlement is pro-rated
 * by (days/30). This is an approximation, not exact accounting — flagged
 * here and in the implementation summary.
 *
 * Entitlement is per ration card, so it is NOT multiplied by member_count:
 * one active card contributes exactly its category's per-card allocation.
 * Reading it per-person here (as this query used to) would have overstated
 * entitlement for every multi-member household and made utilisation look
 * permanently low.
 */
async function getEntitlementVsActual(groupBy, range) {
    const normalizedGroupBy = groupBy === "district" ? "district" : "shop";
    const normalizedRange = _normalizeRange(range);
    const days = RANGE_TO_DAYS[normalizedRange];
    const prorationFactor = days / 30;

    return _cached(`entitlement-vs-actual:${normalizedGroupBy}:${normalizedRange}`, async () => {
        const groupCols = normalizedGroupBy === "district"
            ? "a.id AS group_id, a.name AS group_label"
            : "s.id AS group_id, s.shop_code || ' — ' || s.shop_name AS group_label";
        const groupBySql = normalizedGroupBy === "district" ? "a.id, a.name" : "s.id, s.shop_code, s.shop_name";

        const { rows } = await pool.query(
            `WITH card_entitlement AS (
         SELECT
           rc.shop_id,
           p.rice_per_card_grams  / 1000.0 AS rice_entitled,
           p.wheat_per_card_grams / 1000.0 AS wheat_entitled
         FROM ration_cards rc
         JOIN policies p ON p.category = rc.category
         WHERE rc.is_active = true
       ),
       entitlement_by_shop AS (
         SELECT shop_id,
           SUM(rice_entitled) AS rice_entitled,
           SUM(wheat_entitled) AS wheat_entitled
         FROM card_entitlement
         GROUP BY shop_id
       ),
       actual_by_shop AS (
         SELECT shop_id,
           SUM(rice_qty_kg) AS rice_actual,
           SUM(wheat_qty_kg) AS wheat_actual
         FROM transactions
         WHERE created_at >= NOW() - make_interval(days => $2::int)
         GROUP BY shop_id
       )
       SELECT
         ${groupCols},
         SUM(COALESCE(eb.rice_entitled, 0)) * $1::float AS rice_entitled,
         SUM(COALESCE(eb.wheat_entitled, 0)) * $1::float AS wheat_entitled,
         SUM(COALESCE(ab.rice_actual, 0)) AS rice_actual,
         SUM(COALESCE(ab.wheat_actual, 0)) AS wheat_actual
       FROM shops s
       JOIN areas a ON a.id = s.area_id
       LEFT JOIN entitlement_by_shop eb ON eb.shop_id = s.id
       LEFT JOIN actual_by_shop ab ON ab.shop_id = s.id
       GROUP BY ${groupBySql}`,
            [prorationFactor, days]
        );

        const results = rows.map((r) => {
            const entitledTotal = Number(r.rice_entitled) + Number(r.wheat_entitled);
            const actualTotal = Number(r.rice_actual) + Number(r.wheat_actual);
            return {
                id: r.group_id,
                label: r.group_label,
                entitled: {
                    rice_kg: Number(r.rice_entitled),
                    wheat_kg: Number(r.wheat_entitled),
                    total_kg: entitledTotal,
                },
                actual: {
                    rice_kg: Number(r.rice_actual),
                    wheat_kg: Number(r.wheat_actual),
                    total_kg: actualTotal,
                },
                gap_kg: entitledTotal - actualTotal, // positive = under-dispensed, negative = over-dispensed
            };
        });

        results.sort((a, b) => Math.abs(b.gap_kg) - Math.abs(a.gap_kg));

        return { groupBy: normalizedGroupBy, range: normalizedRange, results };
    });
}

/**
 * Current snapshot: count of beneficiaries (heads of active ration cards,
 * matching the definition used by getAreas and getBeneficiaries — a
 * "beneficiary" is a ration-card holder, not every listed family member)
 * by NFSA category.
 */
async function getCategoryBreakdown() {
    return _cached("category-breakdown", async () => {
        const { rows } = await pool.query(
            `SELECT rc.category, COUNT(fm.id)::int AS beneficiary_count
       FROM ration_cards rc
       JOIN family_members fm ON fm.ration_card_id = rc.id AND fm.is_head = true
       WHERE rc.is_active = true
       GROUP BY rc.category
       ORDER BY rc.category`
        );

        const total = rows.reduce((sum, r) => sum + r.beneficiary_count, 0);

        return {
            total,
            categories: rows.map((r) => ({
                category: r.category,
                count: r.beneficiary_count,
                percentage: total > 0 ? Number(((r.beneficiary_count / total) * 100).toFixed(1)) : 0,
            })),
        };
    });
}

module.exports = { getDistributionTrend, getEntitlementVsActual, getCategoryBreakdown };
