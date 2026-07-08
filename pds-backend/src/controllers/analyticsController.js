const analyticsService = require("../services/analyticsService");
const activityFeedService = require("../services/activityFeedService");

// GET /api/admin/analytics/distribution-trend?range=7d|30d|90d
const getDistributionTrend = async (req, res, next) => {
  try {
    const data = await analyticsService.getDistributionTrend(req.query.range);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

// GET /api/admin/analytics/entitlement-vs-actual?groupBy=shop|district&range=7d|30d|90d
const getEntitlementVsActual = async (req, res, next) => {
  try {
    const data = await analyticsService.getEntitlementVsActual(req.query.groupBy, req.query.range);
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

// GET /api/admin/analytics/category-breakdown
const getCategoryBreakdown = async (req, res, next) => {
  try {
    const data = await analyticsService.getCategoryBreakdown();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

// GET /api/admin/activity/feed?since=<ISO cursor>&limit=50&filter=all|anomalies|blockchain
const getActivityFeed = async (req, res, next) => {
  try {
    const data = await activityFeedService.getActivityFeed({
      since: req.query.since,
      limit: req.query.limit,
      filter: req.query.filter,
    });
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDistributionTrend, getEntitlementVsActual, getCategoryBreakdown, getActivityFeed };
