const pool = require("../config/db");

const PAGE_SIZE = 20;

// GET /api/admin/iot/sessions?shop_id&from&to&state — paginated, filtered.
const listSessions = async ({ shopId, from, to, state, page = 1 } = {}) => {
    const conditions = [];
    const params = [];

    if (shopId) {
        params.push(shopId);
        conditions.push(`ds.shop_id = $${params.length}`);
    }
    if (state) {
        params.push(state);
        conditions.push(`ds.state = $${params.length}`);
    }
    if (from) {
        params.push(from);
        conditions.push(`ds.opened_at >= $${params.length}`);
    }
    if (to) {
        params.push(to);
        conditions.push(`ds.opened_at <= $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * PAGE_SIZE;

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM dispense_sessions ds ${whereClause}`,
        params,
    );

    const listResult = await pool.query(
        `SELECT
        ds.id, ds.shop_id, s.shop_name, ds.ration_card_id, ds.commodity,
        ds.entitled_grams, ds.tolerance_grams, ds.device_id, ds.state,
        ds.opened_at, ds.attached_at, ds.committed_at, ds.expires_at,
        dr.id AS dispense_record_id, dr.measured_grams, dr.blockchain_tx_hash
     FROM dispense_sessions ds
     JOIN shops s ON s.id = ds.shop_id
     LEFT JOIN dispense_records dr ON dr.session_id = ds.id
     ${whereClause}
     ORDER BY ds.opened_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, PAGE_SIZE, offset],
    );

    return {
        sessions: listResult.rows,
        total: countResult.rows[0].count,
        page: safePage,
        pageSize: PAGE_SIZE,
    };
};

// GET /api/admin/iot/sessions/:id — full timeline: the session row, its
// reading trace (for the chart), and its dispense_record if it committed.
const getSessionTimeline = async (sessionId) => {
    const sessionResult = await pool.query(
        `SELECT ds.*, s.shop_name
     FROM dispense_sessions ds
     JOIN shops s ON s.id = ds.shop_id
     WHERE ds.id = $1`,
        [sessionId],
    );

    if (sessionResult.rows.length === 0) {
        return null;
    }

    const readingsResult = await pool.query(
        `SELECT grams_int, taken_at FROM sensor_readings WHERE session_id = $1 ORDER BY taken_at ASC`,
        [sessionId],
    );

    const recordResult = await pool.query(
        `SELECT id, measured_grams, prev_hash, row_hash, committed_at, blockchain_tx_hash
     FROM dispense_records WHERE session_id = $1`,
        [sessionId],
    );

    return {
        session: sessionResult.rows[0],
        readings: readingsResult.rows,
        dispense_record: recordResult.rows[0] || null,
    };
};

module.exports = { listSessions, getSessionTimeline };
