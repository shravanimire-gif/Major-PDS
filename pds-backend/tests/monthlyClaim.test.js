require('./setup');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../src/app');
const dispenseSessionService = require('../src/services/dispenseSessionService');
const { getClaimedCommodities } = require('../src/services/monthlyClaimService');
const { Pool } = require('pg');
require('dotenv').config();

jest.setTimeout(30000);

// Monthly eligibility must be ONE shared rule across manual and IoT
// dispensing, evaluated per commodity, and guaranteed by the database rather
// than by a SELECT-then-INSERT that two concurrent requests can both pass.
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

let areaId, shopId, shopkeeperId, shopkeeperToken, headUserId;

const seedCard = async (cardNumber) => {
    const head = await pool.query(
        `INSERT INTO users (role, name, mobile) VALUES ('beneficiary', $1, $2) RETURNING id`,
        [`Head ${cardNumber}`, `9${Math.floor(100000000 + Math.random() * 899999999)}`],
    );
    const rc = await pool.query(
        `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
     VALUES ($1, 'AAY', $2, $3, $4) RETURNING id`,
        [cardNumber, head.rows[0].id, shopId, areaId],
    );
    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'Head', 40, true)`,
        [rc.rows[0].id, head.rows[0].id],
    );
    // AAY per-card allocation: 4000 g rice / 3000 g wheat
    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg) VALUES ($1, 4, 3)`,
        [rc.rows[0].id],
    );
    return { rationCardId: rc.rows[0].id, headUserId: head.rows[0].id };
};

const makeQr = async (rationCardId, issuedTo = null) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    await pool.query(
        `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, rationCardId, shopId, issuedTo, new Date(Date.now() + 60000)],
    );
    return sessionId;
};

const manualDispense = async (rationCardId, issuedTo, { rice = 0, wheat = 0 }) => {
    const qr = await makeQr(rationCardId, issuedTo);
    return request(app)
        .post('/api/shopkeeper/dispense')
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ ration_card_id: rationCardId, session_id: qr, rice_qty_kg: rice, wheat_qty_kg: wheat });
};

// Opens + attaches + advances a session to 'weighing' so commitSession accepts it.
const openIotSession = async (rationCardId, commodity, grams) => {
    const qr = await makeQr(rationCardId);
    const create = await request(app)
        .post('/api/dispense/session')
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ ration_card_id: rationCardId, commodity, entitled_grams: grams, qr_session_id: qr });
    if (create.status !== 201) return { created: create, sessionId: null };

    await request(app)
        .post(`/api/dispense/session/${create.body.session_id}/attach`)
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ session_jwt: create.body.session_jwt });
    await dispenseSessionService.beginWeighing(create.body.session_id);
    return { created: create, sessionId: create.body.session_id };
};

beforeAll(async () => {
    await pool.query(`
    INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES ('AAY', 4000, 3000)
    ON CONFLICT (category) DO UPDATE SET rice_per_card_grams = EXCLUDED.rice_per_card_grams,
                                         wheat_per_card_grams = EXCLUDED.wheat_per_card_grams
  `);
    const area = await pool.query(
        `INSERT INTO areas (name) VALUES ('ClaimArea') ON CONFLICT (name) DO UPDATE SET name='ClaimArea' RETURNING id`,
    );
    areaId = area.rows[0].id;

    const sk = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash) VALUES ('shopkeeper', 'claim-sk@pds.gov', '+919888888888', $1) RETURNING id`,
        [await bcrypt.hash('pw', 10)],
    );
    shopkeeperId = sk.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shop = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('CLAIM-001', 'Claim Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shop.rows[0].id;

    await pool.query(`INSERT INTO iot_devices (device_id, device_token_hash, shop_id) VALUES ($1, $2, $3)`, [
        'esp32-claim-01',
        await bcrypt.hash('claim-token', 10),
        shopId,
    ]);
});

afterAll(async () => {
    await pool.end();
});

describe('Case 1 — no transaction this month, IoT allowed', () => {
    it('commits one transaction', async () => {
        const { rationCardId } = await seedCard('CLAIM-C1');
        const { sessionId } = await openIotSession(rationCardId, 'rice', 4000);
        const result = await dispenseSessionService.commitSession(sessionId, 4000);

        expect(result.success).toBe(true);
        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(tx.rows[0].c).toBe(1);
    });
});

describe('Case 2 — no transaction this month, manual allowed', () => {
    it('creates one transaction', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C2');
        const res = await manualDispense(rationCardId, head, { rice: 4, wheat: 3 });

        expect(res.status).toBe(200);
        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(tx.rows[0].c).toBe(1);
    });
});

describe('Case 3 — IoT already claimed, manual rejected', () => {
    it('rejects the manual claim for the same commodity', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C3');
        const { sessionId } = await openIotSession(rationCardId, 'rice', 4000);
        expect((await dispenseSessionService.commitSession(sessionId, 4000)).success).toBe(true);

        const res = await manualDispense(rationCardId, head, { rice: 4, wheat: 0 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Already claimed this month');

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(tx.rows[0].c).toBe(1);
    });

    it('still allows the OTHER commodity — IoT writes one commodity per row', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C3B');
        const { sessionId } = await openIotSession(rationCardId, 'rice', 4000);
        expect((await dispenseSessionService.commitSession(sessionId, 4000)).success).toBe(true);

        // wheat was never claimed, so it must remain available
        const res = await manualDispense(rationCardId, head, { rice: 0, wheat: 3 });
        expect(res.status).toBe(200);
        expect(await getClaimedCommodities(pool, rationCardId)).toEqual(['rice', 'wheat']);
    });
});

describe('Case 4 — manual already claimed, IoT rejected', () => {
    it('refuses to open a session for an already-claimed commodity', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C4');
        expect((await manualDispense(rationCardId, head, { rice: 4, wheat: 0 })).status).toBe(200);

        const { created } = await openIotSession(rationCardId, 'rice', 4000);
        expect(created.status).toBe(400);
        expect(created.body.error).toMatch(/already been served/i);
    });

    it('rejects at commit even if the session was opened before the manual claim', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C4B');
        // session opened FIRST, so the create-time check passes
        const { sessionId } = await openIotSession(rationCardId, 'rice', 4000);
        // …then the manual claim lands while the scale is still being loaded
        expect((await manualDispense(rationCardId, head, { rice: 4, wheat: 0 })).status).toBe(200);

        const result = await dispenseSessionService.commitSession(sessionId, 4000);
        expect(result.success).toBe(false);
        expect(result.reason).toBe('already_claimed');

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(tx.rows[0].c).toBe(1); // only the manual one

        const state = await pool.query(`SELECT state FROM dispense_sessions WHERE id = $1`, [sessionId]);
        expect(state.rows[0].state).toBe('failed_already_claimed');
    });
});

describe('Case 5 — retrying the same IoT session', () => {
    it('produces no second transaction, claim or wallet debit', async () => {
        const { rationCardId } = await seedCard('CLAIM-C5');
        const { sessionId } = await openIotSession(rationCardId, 'rice', 4000);

        expect((await dispenseSessionService.commitSession(sessionId, 4000)).success).toBe(true);
        const retry = await dispenseSessionService.commitSession(sessionId, 4000);
        expect(retry.success).toBe(false);
        expect(retry.reason).toMatch(/invalid_state/);

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        const dr = await pool.query(`SELECT COUNT(*)::int c FROM dispense_records WHERE session_id = $1`, [sessionId]);
        const w = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [rationCardId]);

        expect(tx.rows[0].c).toBe(1);
        expect(dr.rows[0].c).toBe(1);
        expect(Number(w.rows[0].rice_balance_kg)).toBe(0); // 4 - 4, debited once
    });
});

describe('Case 6 — concurrent IoT + manual', () => {
    it('exactly one succeeds and exactly one transaction exists', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C6');
        const { sessionId } = await openIotSession(rationCardId, 'rice', 4000);

        // fired together — the old pool-based pre-check let both through
        const [iot, manual] = await Promise.all([
            dispenseSessionService.commitSession(sessionId, 4000),
            manualDispense(rationCardId, head, { rice: 4, wheat: 0 }),
        ]);

        const succeeded = [iot.success === true, manual.status === 200].filter(Boolean).length;
        expect(succeeded).toBe(1);

        const tx = await pool.query(
            `SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1 AND rice_qty_kg > 0`,
            [rationCardId],
        );
        expect(tx.rows[0].c).toBe(1);
    });

    it('the database rejects a second rice claim even with the service bypassed', async () => {
        const { rationCardId } = await seedCard('CLAIM-C6B');
        await pool.query(
            `INSERT INTO transactions (ration_card_id, shop_id, served_by, rice_qty_kg, wheat_qty_kg)
       VALUES ($1, $2, $3, 4, 0)`,
            [rationCardId, shopId, shopkeeperId],
        );

        // raw INSERT, no application check at all
        await expect(
            pool.query(
                `INSERT INTO transactions (ration_card_id, shop_id, served_by, rice_qty_kg, wheat_qty_kg)
         VALUES ($1, $2, $3, 4, 0)`,
                [rationCardId, shopId, shopkeeperId],
            ),
        ).rejects.toThrow(/transactions_rice_monthly_claim_unique_index/);
    });
});

describe('Case 7 — a previous month does not block the current one', () => {
    it('allows a fresh claim when the prior transaction is last month', async () => {
        const { rationCardId, headUserId: head } = await seedCard('CLAIM-C7');
        await pool.query(
            `INSERT INTO transactions (ration_card_id, shop_id, served_by, rice_qty_kg, wheat_qty_kg, created_at)
       VALUES ($1, $2, $3, 4, 3, date_trunc('month', CURRENT_DATE) - INTERVAL '10 days')`,
            [rationCardId, shopId, shopkeeperId],
        );

        expect(await getClaimedCommodities(pool, rationCardId)).toEqual([]);
        const res = await manualDispense(rationCardId, head, { rice: 4, wheat: 3 });
        expect(res.status).toBe(200);
    });
});

describe('the rule is shared, not duplicated', () => {
    it('the legacy /transactions endpoint enforces the same per-commodity rule', async () => {
        const { rationCardId } = await seedCard('CLAIM-LEGACY');
        const first = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, rice_qty: 4, wheat_qty: 0 });
        expect(first.status).toBe(200);

        const second = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, rice_qty: 4, wheat_qty: 0 });
        expect(second.status).toBe(400);
        expect(second.body.error).toBe('Already claimed this month');

        // wheat is untouched and still claimable
        const wheat = await request(app)
            .post('/api/shopkeeper/transactions')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, rice_qty: 0, wheat_qty: 3 });
        expect(wheat.status).toBe(200);
    });
});
