const express = require("express");
const { verifyToken, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { registerDeviceSchema, deviceAssignmentSchema, deviceStatusSchema } = require("../validators/iot");
const {
    registerDevice,
    rotateToken,
    listDevices,
    setDeviceStatus,
    setDeviceAssignment,
    getFleet,
    recalibrateDevice,
} = require("../controllers/iotController");
const { getAnchorStatus } = require("../controllers/anchorStatusController");
const { listSessions, getSessionTimeline } = require("../controllers/sessionForensicsController");

const router = express.Router();

router.use(verifyToken, requireRole("admin"));

router.post("/devices", validate(registerDeviceSchema), registerDevice);
router.get("/devices", listDevices);
router.post("/devices/:deviceId/rotate-token", rotateToken);
router.patch("/devices/:deviceId/status", validate(deviceStatusSchema), setDeviceStatus);
router.patch("/devices/:deviceId/assignment", validate(deviceAssignmentSchema), setDeviceAssignment);
router.post("/devices/:deviceId/recalibrate", recalibrateDevice);

router.get("/fleet", getFleet);
router.get("/anchor-status", getAnchorStatus);
router.get("/sessions", listSessions);
router.get("/sessions/:id", getSessionTimeline);

module.exports = router;
