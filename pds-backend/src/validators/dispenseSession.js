const Joi = require("joi");
const { MAX_DISPENSE_TRANSACTION_GRAMS } = require("../config/allocation");

const createSessionSchema = Joi.object({
    ration_card_id: Joi.string().uuid().required(),
    commodity: Joi.string().valid("rice", "wheat").required(),
    // Business ceiling (config/allocation.js), not the load cell's 5 kg
    // frame-sanity ceiling (MAX_VALID_GRAMS in config/iot.js) — a
    // beneficiary's whole allocation for one commodity must fit in one
    // transaction. The service re-derives this from the card's policy and
    // rejects any mismatch, so this schema only bounds the shape.
    entitled_grams: Joi.number().integer().min(1).max(MAX_DISPENSE_TRANSACTION_GRAMS).required(),
    qr_session_id: Joi.string().required(),
});

// session_jwt travels in the body, not Authorization — that header is
// already occupied by the shopkeeper's own login JWT (verifyToken).
const attachSchema = Joi.object({
    session_jwt: Joi.string().required(),
});

module.exports = { createSessionSchema, attachSchema };
