const Joi = require("joi");
// Phase 3 — WS frame schemas moved to validators/iotFrames.js, which now
// centralizes every inbound WS frame (device + admin + shopkeeper), not
// just the device one. Re-exported here so existing imports of
// deviceReadingFrameSchema from this file keep working unchanged.
const { deviceReadingFrameSchema } = require("./iotFrames");

const registerDeviceSchema = Joi.object({
    device_id: Joi.string().min(3).max(100).required(),
    shop_id: Joi.string().uuid().required(),
});

const deviceStatusSchema = Joi.object({
    status: Joi.string().valid("active", "revoked", "inactive").required(),
});

module.exports = {
    registerDeviceSchema,
    deviceStatusSchema,
    deviceReadingFrameSchema,
};
