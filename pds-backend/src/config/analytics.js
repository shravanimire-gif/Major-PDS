/**
 * analytics.js
 *
 * Named constants for the /api/admin/analytics/* endpoints.
 */
module.exports = {
    // Aggregate queries are cached per parameter combination for this long
    // before re-running against the DB.
    ANALYTICS_CACHE_TTL_MS: 60_000, // 60s

    VALID_RANGES: ["7d", "30d", "90d"],
    DEFAULT_RANGE: "7d",
    RANGE_TO_DAYS: { "7d": 7, "30d": 30, "90d": 90 },

    // Activity feed (never cached — see activityFeedService.js).
    ACTIVITY_FEED_DEFAULT_LOOKBACK_MS: 24 * 60 * 60 * 1000, // 24h, used only when no `since` cursor is given
    ACTIVITY_FEED_DEFAULT_LIMIT: 50,
    ACTIVITY_FEED_MAX_LIMIT: 200,
};
