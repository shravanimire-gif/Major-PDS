const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { runEntitlementAllocation } = require("../services/entitlementService");

const router = express.Router();

router.get(
  "/entitlements/preview",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await runEntitlementAllocation({ previewOnly: true });

      return res.status(200).json({ preview: result.allocations });
    } catch (err) {
      return res.status(500).json({
        error: "Preview failed",
        detail: err.message,
      });
    }
  },
);

router.post(
  "/entitlements/allocate",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await runEntitlementAllocation();

      if (result.skipped) {
        return res.status(200).json({
          skipped: true,
          reason: result.reason,
          processed: 0,
          allocations: [],
        });
      }

      return res.status(200).json({
        message: "Allocation complete",
        processed: result.processed,
        allocations: result.allocations,
      });
    } catch (err) {
      return res.status(500).json({
        error: "Allocation failed",
        detail: err.message,
      });
    }
  },
);

module.exports = router;
