const Joi = require('joi');

const mobilePattern = /^\+91[0-9]{10}$/;

const createRationCardSchema = Joi.object({
    card_number: Joi.string().required(),
    category: Joi.string().valid('APL', 'BPL', 'AAY').required(),
    shop_id: Joi.string().uuid().required(),
    head: Joi.object({
        name: Joi.string().min(2).required(),
        age: Joi.number().min(18).max(100).required(),
        mobile: Joi.string().min(7).max(20).required(),
    }).required(),
    members: Joi.array()
        .items(
            Joi.object({
                name: Joi.string().min(2).required(),
                age: Joi.number().min(0).max(120).required(),
            })
        )
        .default([]),
});

const createShopkeeperSchema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().min(7).max(20).required(),
    password: Joi.string().min(6).required(),
    shop_id: Joi.alternatives([Joi.string().uuid(), Joi.valid(null, '')]).optional(),
});

const updateUserSchema = Joi.object({
    name: Joi.string().min(2).max(150),
    email: Joi.string().email(),
    mobile: Joi.string().min(7).max(20),
    is_active: Joi.boolean(),
}).min(1);

const createAreaSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    is_active: Joi.boolean().default(true),
});

const updateAreaSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    is_active: Joi.boolean(),
}).min(1);

const createShopSchema = Joi.object({
    shop_code: Joi.string().max(20).required(),
    shop_name: Joi.string().max(150).required(),
    area_id: Joi.string().uuid().required(),
});

module.exports = {
    createRationCardSchema,
    createShopkeeperSchema,
    updateUserSchema,
    createAreaSchema,
    updateAreaSchema,
    createShopSchema,
};
