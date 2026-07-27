const pool = require("../config/db");
const logger = require("../config/logger");
const dispenseSessionService = require("../services/dispenseSessionService");
const auditLogService = require("../services/auditLogService");
const { getAssignedShop } = require("./shopkeeperController");

const sendServiceError = (res, result) => res.status(result.status || 400).json({ error: result.message, code: result.code });

// POST /api/dispense/session
const createSession = async (req, res, next) => {
    try {
        const shop = await getAssignedShop(pool, req.user.id);
        if (!shop) {
            return res.status(404).json({ error: "No active shop assigned" });
        }

        const {
            ration_card_id: rationCardId,
            commodity,
            entitled_grams: entitledGrams,
            qr_session_id: qrSessionId,
        } = req.body;

        const result = await dispenseSessionService.createSession({
            shopId: shop.id,
            rationCardId,
            commodity,
            entitledGrams,
            qrSessionId,
        });

        if (!result.ok) {
            logger.warn("[IoT] createSession rejected", { shopId: shop.id, code: result.code });
            return sendServiceError(res, result);
        }

        return res.status(201).json({
            session_id: result.sessionId,
            session_jwt: result.sessionJwt,
            expires_at: result.expiresAt,
            tolerance_grams: result.toleranceGrams,
        });
    } catch (err) {
        return next(err);
    }
};

// POST /api/dispense/session/:id/attach
const attachSession = async (req, res, next) => {
    try {
        const shop = await getAssignedShop(pool, req.user.id);
        if (!shop) {
            return res.status(404).json({ error: "No active shop assigned" });
        }

        const { session_jwt: sessionJwt } = req.body;
        const result = await dispenseSessionService.attachSession(req.params.id, sessionJwt, shop.id);

        if (!result.ok) {
            return sendServiceError(res, result);
        }

        return res.status(200).json({
            session_id: result.sessionId,
            device_id: result.deviceId,
            state: result.state,
        });
    } catch (err) {
        return next(err);
    }
};

// POST /api/dispense/session/:id/cancel
const cancelSession = async (req, res, next) => {
    try {
        const shop = await getAssignedShop(pool, req.user.id);
        if (!shop) {
            return res.status(404).json({ error: "No active shop assigned" });
        }

        const result = await dispenseSessionService.cancelSession(req.params.id, shop.id);
        if (!result.ok) {
            return sendServiceError(res, result);
        }

        logger.info("[IoT] Dispense session cancelled by shopkeeper", {
            shopId: shop.id,
            sessionId: req.params.id,
        });
        auditLogService.record({
            actorType: "shopkeeper",
            actorId: req.user?.id,
            action: "cancel_session",
            target: req.params.id,
            meta: { shopId: shop.id },
        });

        return res.status(200).json({ session_id: result.sessionId, state: result.state });
    } catch (err) {
        return next(err);
    }
};

// GET /api/dispense/device-status — lets the shopkeeper's dispense screen
// know whether to offer the IoT weighing path at all for its own shop.
const getDeviceStatus = async (req, res, next) => {
    try {
        const shop = await getAssignedShop(pool, req.user.id);
        if (!shop) {
            return res.status(404).json({ error: "No active shop assigned" });
        }

        const result = await pool.query(
            `SELECT device_id FROM iot_devices WHERE shop_id = $1 AND status = 'active' LIMIT 1`,
            [shop.id],
        );

        return res.status(200).json({
            active: result.rows.length > 0,
            device_id: result.rows[0]?.device_id || null,
        });
    } catch (err) {
        return next(err);
    }
};

// GET /api/dispense/session/:id
const getSession = async (req, res, next) => {
    try {
        const shop = await getAssignedShop(pool, req.user.id);
        if (!shop) {
            return res.status(404).json({ error: "No active shop assigned" });
        }

        await dispenseSessionService.expireIfStale(req.params.id);

        const result = await dispenseSessionService.getSessionStatus(req.params.id, shop.id);
        if (!result.ok) {
            return sendServiceError(res, result);
        }

        return res.status(200).json({ session: result.session });
    } catch (err) {
        return next(err);
    }
};

module.exports = { createSession, attachSession, cancelSession, getSession, getDeviceStatus };
