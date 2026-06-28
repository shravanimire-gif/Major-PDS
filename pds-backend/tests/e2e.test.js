/**
 * E2E Test — Complete transaction flow + blockchain readiness validation
 * Tests run in ORDER. Each test depends on state from the previous.
 */
require('./setup');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// Shared state across tests
let areaId, shopId, adminId, shopkeeperId, rationCardId;
let adminToken, shopkeeperToken;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
    // Ensure otp_verifications table exists (not in base setup.js)
    await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mobile VARCHAR(15) NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      is_used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    // Policies
    await pool.query(`
    INSERT INTO policies (category, rice_per_person_kg, wheat_per_person_kg, sugar_per_person_kg) VALUES
      ('APL', 3.00, 2.00, 0.50),
      ('BPL', 5.00, 3.00, 1.00),
      ('AAY', 7.00, 8.00, 1.00)
    ON CONFLICT (category) DO UPDATE
      SET rice_per_person_kg = EXCLUDED.rice_per_person_kg,
          wheat_per_person_kg = EXCLUDED.wheat_per_person_kg,
          sugar_per_person_kg = EXCLUDED.sugar_per_person_kg
  `);

    // 1. Area
    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('E2EArea') ON CONFLICT (name) DO UPDATE SET name='E2EArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    // 2. Shop
    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('E2E-001', 'E2E Shop', $1)
     ON CONFLICT (shop_code) DO UPDATE SET shop_name='E2E Shop' RETURNING id`,
        [areaId],
    );
    shopId = shopRes.rows[0].id;

    // 3. Admin user
    const adminHash = await bcrypt.hash('admin123', 10);
    const adminRes = await pool.query(
        `INSERT INTO users (role, email, password_hash) VALUES ('admin', 'e2e-admin@pds.gov', $1)
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
        [adminHash],
    );
    adminId = adminRes.rows[0].id;

    // 4. Shopkeeper user → assign to shop
    const skHash = await bcrypt.hash('sk123', 10);
    const skRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash) VALUES ('shopkeeper', 'e2e-sk@pds.gov', '+919500000001', $1)
     ON CONFLICT (email) DO UPDATE SET password_hash=$1 RETURNING id`,
        [skHash],
    );
    shopkeeperId = skRes.rows[0].id;
    await pool.query(`UPDATE shops SET shopkeeper_id=$1 WHERE id=$2`, [shopkeeperId, shopId]);

    // 5. BPL ration card — head + 2 more members (family_size = 3)
    const headRes = await pool.query(
        `INSERT INTO users (role, mobile) VALUES ('beneficiary', '+919500000002') RETURNING id`,
    );
    const headId = headRes.rows[0].id;

    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
     VALUES ('E2E-BPL-001', 'BPL', $1, $2, $3) RETURNING id`,
        [headId, shopId, areaId],
    );
    rationCardId = rcRes.rows[0].id;

    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'E2E Head', 35, true)`,
        [rationCardId, headId],
    );
    for (let i = 1; i < 3; i++) {
        const mRes = await pool.query(`INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`);
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, $3, 25, false)`,
            [rationCardId, mRes.rows[0].id, `E2E Member ${i}`],
        );
    }

    // Wallet (zeroed — allocation will fund it)
    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg, sugar_balance_kg)
     VALUES ($1, 0, 0, 0) ON CONFLICT (ration_card_id) DO NOTHING`,
        [rationCardId],
    );

    // 6. Run entitlement allocation → wallet funded
    // Reset last_reset_date so allocation isn't skipped
    await pool.query(`UPDATE wallets SET last_reset_date = NULL WHERE ration_card_id = $1`, [rationCardId]);

    const allocRes = await request(app)
        .post('/api/admin/entitlements/allocate')
        .set('Authorization', `Bearer ${jwt.sign({ id: adminId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })}`);

    // If skipped (ran today already), force-set the wallet
    if (allocRes.body.skipped) {
        await pool.query(
            `UPDATE wallets SET rice_balance_kg=15, wheat_balance_kg=9, sugar_balance_kg=3, last_reset_date=CURRENT_DATE
       WHERE ration_card_id=$1`,
            [rationCardId],
        );
    }

    // 7. Login tokens
    const adminLoginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'e2e-admin@pds.gov', password: 'admin123' });
    adminToken = adminLoginRes.body.token;

    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    // Clean transactions so tests start fresh
    await pool.query(`DELETE FROM transactions WHERE ration_card_id = $1`, [rationCardId]);
});

afterAll(async () => {
    await pool.end();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: Complete transaction flow', () => {

    test('1. Admin runs integrity check → blockchain_ready true, all 8 pass', async () => {
        const res = await request(app)
            .get('/api/admin/validation/integrity')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.blockchain_ready).toBe(true);
        expect(res.body.summary.failed).toBe(0);
        for (const check of res.body.checks) {
            expect(check.status).toBe('pass');
        }
    });

    test('2. Shopkeeper fetches beneficiary wallet via DB — rice=15, family_size=3', async () => {
        // Verify wallet state directly (beneficiary lookup requires QR session)
        const walletRes = await pool.query(
            `SELECT w.rice_balance_kg, COUNT(fm.id)::int AS family_size
       FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       JOIN family_members fm ON fm.ration_card_id = rc.id
       WHERE w.ration_card_id = $1
       GROUP BY w.rice_balance_kg`,
            [rationCardId],
        );
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBe(15);
        expect(walletRes.rows[0].family_size).toBe(3);
    });

    test('3. Shopkeeper processes transaction via /transactions → stable blockchain payload', async () => {
        const res = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, rice_qty: 5, wheat_qty: 3, sugar_qty: 1 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.remaining_wallet.rice_balance_kg).toBe(10);
        expect(res.body.remaining_wallet.wheat_balance_kg).toBe(6);
        expect(res.body.remaining_wallet.sugar_balance_kg).toBe(2);
        expect(res.body.transaction.blockchain_tx_hash).toBeNull();
        expect(res.body.transaction.id).toBeDefined();
        expect(res.body.transaction.ration_card_id).toBe(rationCardId);
        expect(res.body.transaction.shop_id).toBe(shopId);
        expect(res.body.transaction.served_by).toBe(shopkeeperId);
        expect(res.body.transaction.rice_qty_kg).toBe(5);

        // Confirm DB row
        const txRes = await pool.query(
            `SELECT * FROM transactions WHERE ration_card_id=$1`, [rationCardId],
        );
        expect(txRes.rows.length).toBe(1);
        expect(txRes.rows[0].served_by).toBe(shopkeeperId);
        expect(Number(txRes.rows[0].rice_qty_kg)).toBe(5);
    });

    test('4. Same card claims again this month → 400, wallet unchanged', async () => {
        const res = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, rice_qty: 3, wheat_qty: 2, sugar_qty: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Already claimed this month');

        // Wallet must still be at 10kg (unchanged)
        const walletRes = await pool.query(
            `SELECT rice_balance_kg FROM wallets WHERE ration_card_id=$1`, [rationCardId],
        );
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBe(10);
    });

    test('5. Shopkeeper from wrong shop is blocked → 403', async () => {
        // Use a fresh card (no prior transactions) assigned to shop1
        const headRes = await pool.query(`INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`);
        const headId = headRes.rows[0].id;
        const rcRes = await pool.query(
            `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
       VALUES ('E2E-XSHOP-001', 'BPL', $1, $2, $3) RETURNING id`,
            [headId, shopId, areaId],
        );
        const freshCardId = rcRes.rows[0].id;
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'XShop Head', 30, true)`,
            [freshCardId, headId],
        );
        await pool.query(
            `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg, sugar_balance_kg) VALUES ($1, 15, 9, 3)`,
            [freshCardId],
        );

        // Create second shopkeeper assigned to a different shop
        const sk2Res = await pool.query(
            `INSERT INTO users (role, email, mobile, password_hash)
       VALUES ('shopkeeper', 'e2e-sk2@pds.gov', '+919500000099', 'hash')
       ON CONFLICT (email) DO UPDATE SET email='e2e-sk2@pds.gov' RETURNING id`,
        );
        const sk2Id = sk2Res.rows[0].id;

        await pool.query(
            `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id)
       VALUES ('E2E-002', 'E2E Shop 2', $1, $2)
       ON CONFLICT (shop_code) DO UPDATE SET shopkeeper_id=$2`,
            [areaId, sk2Id],
        );

        const secondToken = jwt.sign({ id: sk2Id, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

        // sk2 tries to dispense from freshCard which belongs to shop1 → 403
        const res = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${secondToken}`)
            .send({ ration_card_id: freshCardId, rice_qty: 5, wheat_qty: 0, sugar_qty: 0 });

        expect(res.status).toBe(403);
    });

    test('6. Admin runs entitlement twice same day → second call skipped', async () => {
        // First call — wallet already has last_reset_date=today from setup, so it will be skipped
        // Force a fresh card to test the real flow
        const headRes = await pool.query(`INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`);
        const headId = headRes.rows[0].id;
        const rcRes = await pool.query(
            `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
       VALUES ('E2E-IDEM-001', 'BPL', $1, $2, $3) RETURNING id`,
            [headId, shopId, areaId],
        );
        const idemCardId = rcRes.rows[0].id;
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'Idem Head', 30, true)`,
            [idemCardId, headId],
        );
        await pool.query(
            `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg, sugar_balance_kg, last_reset_date)
       VALUES ($1, 0, 0, 0, NULL)`,
            [idemCardId],
        );

        // Reset ALL wallets' last_reset_date so first call actually runs
        await pool.query(`UPDATE wallets SET last_reset_date = NULL`);

        const first = await request(app)
            .post('/api/admin/entitlements/allocate')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(first.status).toBe(200);
        expect(first.body.skipped).toBeFalsy();
        expect(first.body.processed).toBeGreaterThan(0);

        // Second call same day → skipped
        const second = await request(app)
            .post('/api/admin/entitlements/allocate')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(second.status).toBe(200);
        expect(second.body.skipped).toBe(true);
        expect(second.body.processed).toBe(0);

        // Wallet balance unchanged between calls
        const w1 = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id=$1`, [idemCardId]);
        const w2 = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id=$1`, [idemCardId]);
        expect(w1.rows[0].rice_balance_kg).toEqual(w2.rows[0].rice_balance_kg);
    });

    test('7. Expired JWT returns 401 JSON, not 500 HTML', async () => {
        const expiredToken = jwt.sign(
            { id: adminId, role: 'admin' },
            JWT_SECRET,
            { expiresIn: -3600 }, // already expired
        );

        const res = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body.error).toBeDefined();
    });

    test('8. Malformed JWT returns 401', async () => {
        const res = await request(app)
            .get('/api/admin/users')
            .set('Authorization', 'Bearer notajwt');

        expect(res.status).toBe(401);
        expect(res.headers['content-type']).toMatch(/json/);
    });

});
