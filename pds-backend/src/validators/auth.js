const Joi = require('joi');

const mobilePattern = /^\+91[0-9]{10}$/;

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

const otpSendSchema = Joi.object({
    mobile: Joi.string()
        .pattern(mobilePattern)
        .required()
        .messages({ 'string.pattern.base': 'Mobile must be in format +91XXXXXXXXXX' }),
});

const otpVerifySchema = Joi.object({
    mobile: Joi.string()
        .pattern(mobilePattern)
        .required()
        .messages({ 'string.pattern.base': 'Mobile must be in format +91XXXXXXXXXX' }),
    otp: Joi.string().length(6).required(),
});

module.exports = { loginSchema, otpSendSchema, otpVerifySchema };
