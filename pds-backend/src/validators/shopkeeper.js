const Joi = require('joi');

const dispenseSchema = Joi.object({
    ration_card_id: Joi.string().uuid().required(),
    session_id: Joi.string().required(),
    beneficiary_user_id: Joi.string().uuid().optional(),
    rice_qty_kg: Joi.number().min(0).required(),
    wheat_qty_kg: Joi.number().min(0).required(),
    sugar_qty_kg: Joi.number().min(0).required(),
}).custom((value, helpers) => {
    if (value.rice_qty_kg === 0 && value.wheat_qty_kg === 0 && value.sugar_qty_kg === 0) {
        return helpers.error('any.invalid');
    }
    return value;
}).messages({
    'any.invalid': 'At least one quantity must be greater than 0',
});

// Blockchain-stable transaction schema — shape is final and must never change
const transactionSchema = Joi.object({
    ration_card_id: Joi.string().uuid().required(),
    rice_qty: Joi.number().min(0).required(),
    wheat_qty: Joi.number().min(0).required(),
    sugar_qty: Joi.number().min(0).required(),
}).custom((value, helpers) => {
    if (value.rice_qty === 0 && value.wheat_qty === 0 && value.sugar_qty === 0) {
        return helpers.error('any.invalid');
    }
    return value;
}).messages({
    'any.invalid': 'At least one quantity must be greater than 0',
});

module.exports = { dispenseSchema, transactionSchema };
