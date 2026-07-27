const pool = require("../config/db");
const logger = require("../config/logger");

// One row per IoT-related admin action (see migrations/018_create_iot_audit.js).
// Never throws outward — an audit-log write failure shouldn't fail the
// action it's recording, only get logged.
const record = async ({ actorType, actorId, action, target, meta = {} }) => {
    try {
        await pool.query(
            `INSERT INTO iot_audit (actor_type, actor_id, action, target, meta_json)
       VALUES ($1, $2, $3, $4, $5)`,
            [actorType, actorId || null, action, target, JSON.stringify(meta)],
        );
    } catch (err) {
        logger.error("[Audit] Failed to record audit entry", {
            action,
            target,
            message: err.message,
        });
    }
};

module.exports = { record };
