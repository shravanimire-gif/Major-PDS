require('./setup');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { Pool } = require('pg');
require('dotenv').config();

// Guards the sugar removal: rice and wheat keep working, and sugar is not a
// commodity the system recognises at any layer — API contract, persistence,
// wallet arithmetic, IoT session validation, analytics, or the blockchain
// payload. These assert *absence*, so they fail loudly if sugar is ever
// reintroduced by a partial revert.
const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

let shopkeeperId, shopId, areaId, rationCardId, shopkeeperToken, adminToken, headUserId;

beforeAll(async () => {
    await pool.query(`
    INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES
      ('BPL', 3000, 2000)
    
    ON CONFLICT (category) DO UPDATE
      SET rice_per_card_grams = EXCLUDED.rice_per_card_grams,
          wheat_per_card_grams = EXCLUDED.wheat_per_card_grams
  `);

    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('SugarTest Area') ON CONFLICT (name) DO UPDATE SET name='SugarTest Area' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const adminRes = await pool.query(
        `INSERT INTO users (role, email, password_hash) VALUES ('admin', 'sugar-admin@pds.gov', $1) RETURNING id`,
        [await bcrypt.hash('abcd1234', 10)],
    );
    adminToken = jwt.sign({ id: adminRes.rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    const skRes = await pool.query(
        `INSERT INTO users (role, email, password_hash, name) VALUES ('shopkeeper', 'sugar-sk@pds.gov', $1, 'SK') RETURNING id`,
        [await bcrypt.hash('abcd1234', 10)],
    );
    shopkeeperId = skRes.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('SUG-001', 'Sugar Test Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shopRes.rows[0].id;

    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ('SUG-CARD-001', 'BPL', $1, $2) RETURNING id`,
        [shopId, areaId],
    );
    rationCardId = rcRes.rows[0].id;

    const headRes = await pool.query(
        `INSERT INTO users (role, name, mobile) VALUES ('beneficiary', 'Sugar Head', '9990001111') RETURNING id`,
    );
    headUserId = headRes.rows[0].id;
    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'Sugar Head', 40, true)`,
        [rationCardId, headUserId],
    );

    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg) VALUES ($1, 3, 2)`,
        [rationCardId],
    );
});

afterAll(async () => {
    await pool.end();
});

const createQrSession = async () => {
    const sessionId = `sugar-test-${Date.now()}-${Math.random()}`;
    await pool.query(
        `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, rationCardId, shopId, headUserId, new Date(Date.now() + 60000)],
    );
    return sessionId;
};

beforeEach(async () => {
    await pool.query(`UPDATE wallets SET rice_balance_kg = 3, wheat_balance_kg = 2 WHERE ration_card_id = $1`, [
        rationCardId,
    ]);
    await pool.query(`DELETE FROM transactions`);
    await pool.query(`DELETE FROM qr_sessions`);
});

describe('supported commodities — rice and wheat still work', () => {
    test('1. a rice dispense succeeds and debits only rice', async () => {
        const sessionId = await createQrSession();

        const res = await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: sessionId, rice_qty_kg: 3, wheat_qty_kg: 0 });

        expect(res.status).toBe(200);
        expect(res.body.dispensed).toEqual({ rice_qty_kg: 3, wheat_qty_kg: 0 });
        expect(res.body.remaining_wallet).toEqual({ rice_balance_kg: 0, wheat_balance_kg: 2 });
    });

    test('2. a wheat dispense succeeds and debits only wheat', async () => {
        const sessionId = await createQrSession();

        const res = await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: sessionId, rice_qty_kg: 0, wheat_qty_kg: 2 });

        expect(res.status).toBe(200);
        expect(res.body.dispensed).toEqual({ rice_qty_kg: 0, wheat_qty_kg: 2 });
        expect(res.body.remaining_wallet).toEqual({ rice_balance_kg: 3, wheat_balance_kg: 0 });
    });
});

describe('sugar is not an accepted commodity', () => {
    test('3. POST /dispense carrying sugar_qty_kg → 400, explicitly rejected (not silently ignored)', async () => {
        const sessionId = await createQrSession();

        const res = await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: sessionId, rice_qty_kg: 3, wheat_qty_kg: 2, sugar_qty_kg: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation failed');
        expect(res.body.details.join(' ')).toMatch(/sugar_qty_kg/);
    });

    test('4. rejected sugar request persists nothing and leaves the wallet untouched', async () => {
        const sessionId = await createQrSession();

        await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: sessionId, rice_qty_kg: 3, wheat_qty_kg: 2, sugar_qty_kg: 1 });

        const txCount = await pool.query(`SELECT COUNT(*)::int AS c FROM transactions`);
        expect(txCount.rows[0].c).toBe(0);

        const wallet = await pool.query(
            `SELECT rice_balance_kg, wheat_balance_kg FROM wallets WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(3);
        expect(Number(wallet.rows[0].wheat_balance_kg)).toBe(2);
    });

    test('5. legacy POST /transactions carrying sugar_qty → 400', async () => {
        const res = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, rice_qty: 5, wheat_qty: 3, sugar_qty: 1 });

        expect(res.status).toBe(400);
        expect(res.body.details.join(' ')).toMatch(/sugar_qty/);
    });
});

describe('sugar cannot be persisted', () => {
    test('6. no sugar column exists on policies, wallets or transactions', async () => {
        const { rows } = await pool.query(
            `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name ILIKE '%sugar%'`,
        );
        expect(rows).toEqual([]);
    });

    test('7. no sugar row survives in commodity_tolerances', async () => {
        const { rows } = await pool.query(`SELECT commodity FROM commodity_tolerances ORDER BY commodity`);
        expect(rows.map((r) => r.commodity)).toEqual(['rice', 'wheat']);
    });

    test('8. inserting a sugar quantity is a hard SQL error, not a silent zero', async () => {
        await expect(
            pool.query(
                `INSERT INTO transactions (ration_card_id, shop_id, rice_qty_kg, wheat_qty_kg, sugar_qty_kg, served_by)
         VALUES ($1, $2, 1, 1, 1, $3)`,
                [rationCardId, shopId, shopkeeperId],
            ),
        ).rejects.toThrow(/sugar_qty_kg/);
    });
});

describe('sugar is absent from IoT dispensing', () => {
    test('9. POST /dispense/session with commodity "sugar" → 400 validation failure', async () => {
        const qrSessionId = await createQrSession();

        const res = await request(app)
            .post('/api/dispense/session')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({
                ration_card_id: rationCardId,
                commodity: 'sugar',
                entitled_grams: 1000,
                qr_session_id: qrSessionId,
            });

        expect(res.status).toBe(400);
        expect(res.body.details.join(' ')).toMatch(/commodity/);
    });

    test('10. the session validator accepts exactly rice and wheat', () => {
        const { createSessionSchema } = require('../src/validators/dispenseSession');
        const base = {
            ration_card_id: '11111111-1111-1111-1111-111111111111',
            entitled_grams: 1000,
            qr_session_id: 'qr-1',
        };

        expect(createSessionSchema.validate({ ...base, commodity: 'rice' }).error).toBeUndefined();
        expect(createSessionSchema.validate({ ...base, commodity: 'wheat' }).error).toBeUndefined();
        expect(createSessionSchema.validate({ ...base, commodity: 'sugar' }).error).toBeDefined();
    });

    test('11. the wallet-column map the IoT commit path debits has no sugar entry', () => {
        const { COMMODITY_BALANCE_COLUMN } = require('../src/services/dispenseSessionService');
        expect(Object.keys(COMMODITY_BALANCE_COLUMN).sort()).toEqual(['rice', 'wheat']);
        expect(COMMODITY_BALANCE_COLUMN.sugar).toBeUndefined();
    });
});

describe('sugar is absent from analytics and the blockchain payload', () => {
    test('12. distribution-trend returns rice/wheat keys only — no sugar_kg', async () => {
        const sessionId = await createQrSession();
        await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: sessionId, rice_qty_kg: 3, wheat_qty_kg: 2 });

        const res = await request(app)
            .get('/api/admin/analytics/distribution-trend?range=7d')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.days.length).toBeGreaterThan(0);
        for (const day of res.body.days) {
            expect(Object.keys(day).sort()).toEqual(['date', 'rice_kg', 'wheat_kg']);
        }
        expect(JSON.stringify(res.body)).not.toMatch(/sugar/i);
    });

    test('13. entitlement allocation computes rice/wheat only', async () => {
        const res = await request(app)
            .get('/api/admin/entitlements/preview')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toMatch(/sugar/i);
        for (const allocation of res.body.preview) {
            expect(allocation.sugar_kg).toBeUndefined();
        }
    });

    test('14. the on-chain payload builder exposes only rice and wheat quantities', () => {
        const blockchainService = require('../src/services/blockchainService');
        expect(blockchainService.recordDispense.length).toBeGreaterThan(0);
        // recordDispense destructures its params object; its source is the
        // authority on what can reach the contract.
        const src = blockchainService.recordDispense.toString();
        expect(src).toMatch(/riceQtyKg/);
        expect(src).toMatch(/wheatQtyKg/);
        expect(src).not.toMatch(/sugar/i);
    });
});
