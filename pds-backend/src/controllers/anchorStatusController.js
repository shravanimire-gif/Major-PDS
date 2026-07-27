const anchorStatusService = require("../services/anchorStatusService");

// GET /api/admin/iot/anchor-status
const getAnchorStatus = async (req, res, next) => {
    try {
        const status = await anchorStatusService.getAnchorStatus();
        return res.status(200).json(status);
    } catch (err) {
        return next(err);
    }
};

module.exports = { getAnchorStatus };
