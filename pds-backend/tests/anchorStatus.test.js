require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
let adminToken;

beforeAll(async () => {
    const adminRes = await pool.query(`INSERT INTO users (role, email, password_hash) VALUES ('admin', 'anchor-status-admin@test.com', 'x') RETURNING id`);
    adminToken = jwt.sign({ id: adminRes.rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    const areaRes = await pool.query(`INSERT INTO areas (name) VALUES ('AnchorStatusArea') RETURNING id`);
    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('ANCH-001', 'Anchor Status Shop', $1) RETURNING id`,
        [areaRes.rows[0].id],
    );
    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ('ANCH-CARD-001', 'BPL', $1, $2) RETURNING id`,
        [shopRes.rows[0].id, areaRes.rows[0].id],
    );
    const sessionRes = await pool.query(
        `INSERT INTO dispense_sessions (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, state, expires_at, committed_at)
     VALUES ($1, $2, 'rice', 5000, 50, 'committed', NOW() + INTERVAL '1 minute', NOW() - INTERVAL '3 minutes') RETURNING id`,
        [shopRes.rows[0].id, rcRes.rows[0].id],
    );
    await pool.query(
        `INSERT INTO dispense_records (session_id, ration_card_id, shop_id, commodity, entitled_grams, measured_grams, row_hash, committed_at, blockchain_tx_hash, last_anchor_error)
     VALUES ($1, $2, $3, 'rice', 5000, 5000, 'hash-pending', NOW() - INTERVAL '3 minutes', NULL, 'RPC timeout')`,
        [sessionRes.rows[0].id, rcRes.rows[0].id, shopRes.rows[0].id],
    );
});

afterAll(async () => {
    await pool.end();
});

describe('GET /api/admin/iot/anchor-status', () => {
    it('returns the expected shape with a pending record reflected', async () => {
        const res = await request(app)
            .get('/api/admin/iot/anchor-status')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                pending_count: expect.any(Number),
                oldest_pending_age_seconds: expect.any(Number),
                level: expect.any(String),
            }),
        );
        // No dispense_records with a non-null blockchain_tx_hash were seeded,
        // so last_success_at is legitimately null — expect.anything() would
        // not match null, so this is asserted directly instead.
        expect(res.body.last_success_at).toBeNull();
        expect(res.body.pending_count).toBeGreaterThanOrEqual(1);
        expect(res.body.last_failure_reason).toBe('RPC timeout');
        expect(['ok', 'amber', 'red']).toContain(res.body.level);
    });

    it('rejects a non-admin caller', async () => {
        const shopkeeperToken = jwt.sign({ id: '00000000-0000-0000-0000-000000000001', role: 'shopkeeper' }, JWT_SECRET, {
            expiresIn: '1h',
        });
        const res = await request(app)
            .get('/api/admin/iot/anchor-status')
            .set('Authorization', `Bearer ${shopkeeperToken}`);
        expect(res.status).toBe(403);
    });
});
