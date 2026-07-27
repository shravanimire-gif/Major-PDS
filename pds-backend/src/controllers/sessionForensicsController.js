const sessionForensicsService = require("../services/sessionForensicsService");

// GET /api/admin/iot/sessions
const listSessions = async (req, res, next) => {
    try {
        const { shop_id: shopId, from, to, state, page } = req.query;
        const result = await sessionForensicsService.listSessions({ shopId, from, to, state, page });
        return res.status(200).json(result);
    } catch (err) {
        return next(err);
    }
};

// GET /api/admin/iot/sessions/:id
const getSessionTimeline = async (req, res, next) => {
    try {
        const timeline = await sessionForensicsService.getSessionTimeline(req.params.id);
        if (!timeline) {
            return res.status(404).json({ error: "Session not found" });
        }
        return res.status(200).json(timeline);
    } catch (err) {
        return next(err);
    }
};

module.exports = { listSessions, getSessionTimeline };
