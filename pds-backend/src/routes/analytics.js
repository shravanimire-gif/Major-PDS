const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  getDistributionTrend,
  getEntitlementVsActual,
  getCategoryBreakdown,
  getActivityFeed,
} = require("../controllers/analyticsController");

const router = express.Router();

router.use(verifyToken, requireRole("admin"));

router.get("/analytics/distribution-trend", getDistributionTrend);
router.get("/analytics/entitlement-vs-actual", getEntitlementVsActual);
router.get("/analytics/category-breakdown", getCategoryBreakdown);
router.get("/activity/feed", getActivityFeed);

module.exports = router;
