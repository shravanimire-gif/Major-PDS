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

let adminToken;
let areaId, shopId;

// Seed policies and base area/shop once
beforeAll(async () => {
    // Admin token
    adminToken = jwt.sign({ id: '00000000-0000-0000-0000-000000000099', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

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

    // Area
    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('TestArea') ON CONFLICT (name) DO UPDATE SET name='TestArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    // Shop
    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('TST-001', 'Test Shop', $1)
     ON CONFLICT (shop_code) DO UPDATE SET shop_name='Test Shop' RETURNING id`,
        [areaId],
    );
    shopId = shopRes.rows[0].id;
});

afterAll(async () => {
    await pool.end();
});

// Helper: seed a ration card with N members and a zeroed wallet
const seedCard = async (cardNumber, category, memberCount) => {
    // Head user
    const headRes = await pool.query(
        `INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`,
    );
    const headId = headRes.rows[0].id;

    // Ration card
    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [cardNumber, category, headId, shopId, areaId],
    );
    const rcId = rcRes.rows[0].id;

    // Head family member
    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'Head', 30, true)`,
        [rcId, headId],
    );

    // Additional members
    for (let i = 1; i < memberCount; i++) {
        const mRes = await pool.query(`INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`);
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, $3, 20, false)`,
            [rcId, mRes.rows[0].id, `Member${i}`],
        );
    }

    // Wallet (zeroed)
    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg, sugar_balance_kg)
     VALUES ($1, 0, 0, 0)`,
        [rcId],
    );

    return rcId;
};

describe('Entitlement Engine', () => {
    beforeEach(async () => {
        // Clear cards/members/wallets between tests but keep area/shop/policies
        await pool.query(`TRUNCATE TABLE transactions, wallets, family_members, ration_cards RESTART IDENTITY CASCADE`);
    });

    test('1. AAY family of 6 gets fixed 35kg rice', async () => {
        await seedCard('AAY-001', 'AAY', 6);

        const res = await request(app)
            .post('/api/admin/entitlements/allocate')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);

        const walletRes = await pool.query(
            `SELECT w.rice_balance_kg FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       WHERE rc.card_number = 'AAY-001'`,
        );
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBe(35);
    });

    test('2. BPL family of 3 gets 15kg rice, 9kg wheat', async () => {
        await seedCard('BPL-001', 'BPL', 3);

        await request(app)
            .post('/api/admin/entitlements/allocate')
            .set('Authorization', `Bearer ${adminToken}`);

        const walletRes = await pool.query(
            `SELECT w.rice_balance_kg, w.wheat_balance_kg FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       WHERE rc.card_number = 'BPL-001'`,
        );
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBe(15);
        expect(Number(walletRes.rows[0].wheat_balance_kg)).toBe(9);
    });

    test('3. APL family of 4 gets 12kg rice (3 × 4)', async () => {
        await seedCard('APL-001', 'APL', 4);

        await request(app)
            .post('/api/admin/entitlements/allocate')
            .set('Authorization', `Bearer ${adminToken}`);

        const walletRes = await pool.query(
            `SELECT w.rice_balance_kg FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       WHERE rc.card_number = 'APL-001'`,
        );
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBe(12);
    });

    test('4. preview does NOT change wallet', async () => {
        await seedCard('BPL-PREV', 'BPL', 3);

        await request(app)
            .get('/api/admin/entitlements/preview')
            .set('Authorization', `Bearer ${adminToken}`);

        const walletRes = await pool.query(
            `SELECT w.rice_balance_kg FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       WHERE rc.card_number = 'BPL-PREV'`,
        );
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBe(0);
    });

    test('5. allocation updates last_reset_date to today', async () => {
        await seedCard('BPL-DATE', 'BPL', 2);

        await request(app)
            .post('/api/admin/entitlements/allocate')
            .set('Authorization', `Bearer ${adminToken}`);

        const walletRes = await pool.query(
            `SELECT w.last_reset_date FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       WHERE rc.card_number = 'BPL-DATE'`,
        );
        // Use local date string to avoid UTC timezone offset issues with DATE columns
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
        const rawDate = walletRes.rows[0].last_reset_date;
        // pg returns DATE as a JS Date at midnight UTC; convert to local date string
        const resetDate = rawDate instanceof Date
            ? rawDate.toLocaleDateString('en-CA')
            : String(rawDate).split('T')[0];
        expect(resetDate).toBe(today);
    });
});
