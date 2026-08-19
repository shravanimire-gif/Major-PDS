const Joi = require("joi");
// Phase 3 — WS frame schemas moved to validators/iotFrames.js, which now
// centralizes every inbound WS frame (device + admin + shopkeeper), not
// just the device one. Re-exported here so existing imports of
// deviceReadingFrameSchema from this file keep working unchanged.
const { deviceReadingFrameSchema } = require("./iotFrames");

const registerDeviceSchema = Joi.object({
    // The device's stable hardware UID, e.g. ESP32-A1B2C3 derived from the
    // chip's factory MAC. Bounded by iot_devices.device_id's VARCHAR(100).
    // Never a COM port — a port number is a property of the PC's USB
    // enumeration order, not of the board.
    device_id: Joi.string().min(3).max(100).required(),
    // Optional: register the hardware now, assign it to a shop as a separate
    // audited action (PATCH .../assignment). An unassigned device cannot
    // connect at all, so registering ahead of assignment is inert.
    shop_id: Joi.string().uuid().allow(null),
    // Human label for the Admin Panel. Purely cosmetic — the UID is identity.
    device_name: Joi.string().max(150).allow("", null),
});

// PATCH /api/admin/iot/devices/:deviceId/assignment
// `null` is the explicit unassign signal, which is why the field is required:
// an absent shop_id would make "unassign" and "malformed request" the same
// thing, and one of those must not silently unassign a live scale.
const deviceAssignmentSchema = Joi.object({
    shop_id: Joi.string().uuid().allow(null).required(),
});

const deviceStatusSchema = Joi.object({
    status: Joi.string().valid("active", "revoked", "inactive").required(),
});

module.exports = {
    registerDeviceSchema,
    deviceAssignmentSchema,
    deviceStatusSchema,
    deviceReadingFrameSchema,
};
