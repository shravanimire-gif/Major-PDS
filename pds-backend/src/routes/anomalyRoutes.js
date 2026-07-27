const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const { listFlags, resolveFlag, runNow } = require("../controllers/anomalyController");

const router = express.Router();

router.use(verifyToken, requireRole("admin"));

router.get("/", listFlags);
router.post("/run-now", runNow);
router.post("/:id/resolve", resolveFlag);

module.exports = router;
