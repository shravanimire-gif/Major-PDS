const Joi = require("joi");

// Centralizes every inbound WebSocket frame schema (device + admin +
// shopkeeper) in one place, all validated the same way (Joi — already the
// established validator throughout this project; no second library added
// for this). Payload validation on every inbound frame, reject-and-log
// rather than crash, per Phase 3's hardening requirement.

// Device -> /ws/iot, one per debounced reading.
const deviceReadingFrameSchema = Joi.object({
    type: Joi.string().valid("reading").required(),
    grams: Joi.number().integer().min(0).max(10000).required(),
    ts: Joi.number().integer().min(0).required(),
    sessionId: Joi.string().max(150).allow(null).default(null),
});

// Browser (admin) -> /ws/admin/live, to scope live-reading updates to one shop.
const adminSubscribeFrameSchema = Joi.object({
    type: Joi.string().valid("subscribe").required(),
    shopId: Joi.string().uuid().required(),
});

// Browser (shopkeeper) -> /ws/shopkeeper/live, to scope dispense-session
// state updates to the session currently being weighed.
const shopkeeperSubscribeFrameSchema = Joi.object({
    type: Joi.string().valid("subscribe").required(),
    sessionId: Joi.string().uuid().required(),
});

module.exports = {
    deviceReadingFrameSchema,
    adminSubscribeFrameSchema,
    shopkeeperSubscribeFrameSchema,
};
