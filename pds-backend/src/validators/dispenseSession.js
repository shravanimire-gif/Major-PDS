const Joi = require("joi");

const createSessionSchema = Joi.object({
    ration_card_id: Joi.string().uuid().required(),
    commodity: Joi.string().valid("rice", "wheat", "sugar").required(),
    entitled_grams: Joi.number().integer().min(1).max(10000).required(),
    qr_session_id: Joi.string().required(),
});

// session_jwt travels in the body, not Authorization — that header is
// already occupied by the shopkeeper's own login JWT (verifyToken).
const attachSchema = Joi.object({
    session_jwt: Joi.string().required(),
});

module.exports = { createSessionSchema, attachSchema };
