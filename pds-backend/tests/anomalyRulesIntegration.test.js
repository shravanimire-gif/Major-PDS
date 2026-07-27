require('./setup');
const { Pool } = require('pg');
require('dotenv').config();

const { runAnomalyRules } = require('../src/services/anomalyRulesService');

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

let shopId, rationCardId, sessionIds;

beforeAll(async () => {
    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('AnomalyRulesArea') ON CONFLICT (name) DO UPDATE SET name='AnomalyRulesArea' RETURNING id`,
    );
    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('ANOM-001', 'Anomaly Test Shop', $1) RETURNING id`,
        [areaRes.rows[0].id],
    );
    shopId = shopRes.rows[0].id;

    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ('ANOM-CARD-001', 'BPL', $1, $2) RETURNING id`,
        [shopId, areaRes.rows[0].id],
    );
    rationCardId = rcRes.rows[0].id;

    // Seed dispense_sessions + dispense_records: 7 commits within a 30s
    // window, well inside the last 10 minutes -> trips RAPID_FIRE (limit 6/min).
    const now = Date.now();
    sessionIds = [];
    for (let i = 0; i < 7; i += 1) {
        const sessionRes = await pool.query(
            `INSERT INTO dispense_sessions (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, state, expires_at, committed_at)
       VALUES ($1, $2, 'rice', 5000, 50, 'committed', NOW() + INTERVAL '1 minute', NOW())
       RETURNING id`,
            [shopId, rationCardId],
        );
        const sessionId = sessionRes.rows[0].id;
        sessionIds.push(sessionId);

        const committedAt = new Date(now - (10 - i) * 1000); // spread across ~10-16s, well within the last 10 minutes
        await pool.query(
            `INSERT INTO dispense_records (session_id, ration_card_id, shop_id, commodity, entitled_grams, measured_grams, row_hash, committed_at)
       VALUES ($1, $2, $3, 'rice', 5000, 5000, $4, $5)`,
            [sessionId, rationCardId, shopId, `hash-${i}`, committedAt],
        );
    }
});

afterAll(async () => {
    await pool.end();
});

describe("anomalyRulesService.runAnomalyRules (integration)", () => {
    it("creates an unresolved RAPID_FIRE flag for the shop", async () => {
        await runAnomalyRules();

        const result = await pool.query(
            `SELECT id, resolved_at, auto_resolved_at FROM anomaly_flags
       WHERE rule_key = 'RAPID_FIRE' AND shop_id = $1`,
            [shopId],
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].resolved_at).toBeNull();
        expect(result.rows[0].auto_resolved_at).toBeNull();
    });

    it("auto-resolves the flag once the condition clears", async () => {
        // Simulate the condition clearing: remove the rapid-fire commits.
        await pool.query(`DELETE FROM dispense_records WHERE shop_id = $1`, [shopId]);

        await runAnomalyRules();

        const result = await pool.query(
            `SELECT auto_resolved_at FROM anomaly_flags WHERE rule_key = 'RAPID_FIRE' AND shop_id = $1`,
            [shopId],
        );
        expect(result.rows[0].auto_resolved_at).not.toBeNull();
    });
});
