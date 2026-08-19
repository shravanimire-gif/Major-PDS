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

jest.setTimeout(40000);

// Regression suite for the three IoT transaction-correctness defects:
//
//   BUG 1  a session could be opened for less than the card's allocation,
//          consuming the month's claim and stranding the remainder.
//   BUG 2  an in-tolerance OVERFILL failed the wallet debit as
//          "insufficient balance", because the debit used the measurement.
//   BUG 3  commitSession did not enforce tolerance, so any direct caller
//          could commit an arbitrarily wrong measurement.
//
// The invariant under test: ONE ALLOCATION -> ONE COMPLETE TRANSACTION.
//   authorised_debit === entitled_grams === the card's whole allocation
//   measured_grams may deviate within tolerance and is preserved for audit
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// BPL: rice 3000 g / wheat 2000 g -> rice tolerance = max(20, 1%) = 30 g
const RICE_ALLOC = 3000;
const WHEAT_ALLOC = 2000;
const RICE_TOL = 30;

let areaId, shopId, shopkeeperId, shopkeeperToken;

const seedCard = async (tag) => {
    const head = await pool.query(
        `INSERT INTO users (role, name, mobile) VALUES ('beneficiary', $1, $2) RETURNING id`,
        [`Head ${tag}`, `9${Math.floor(100000000 + Math.random() * 899999999)}`],
    );
    const rc = await pool.query(
        `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
     VALUES ($1, 'BPL', $2, $3, $4) RETURNING id`,
        [`CORR-${tag}`, head.rows[0].id, shopId, areaId],
    );
    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'H', 40, true)`,
        [rc.rows[0].id, head.rows[0].id],
    );
    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg, last_reset_date)
     VALUES ($1, 3, 2, CURRENT_DATE)`,
        [rc.rows[0].id],
    );
    return { rationCardId: rc.rows[0].id, headUserId: head.rows[0].id };
};

const makeQr = async (rationCardId, issuedTo = null) => {
    const sid = crypto.randomBytes(16).toString('hex');
    await pool.query(
        `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
        [sid, rationCardId, shopId, issuedTo, new Date(Date.now() + 60000)],
    );
    return sid;
};

const createSessionApi = (rationCardId, commodity, entitledGrams) =>
    makeQr(rationCardId).then((qr) =>
        request(app)
            .post('/api/dispense/session')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, commodity, entitled_grams: entitledGrams, qr_session_id: qr }),
    );

// Opens a session for the full allocation and advances it to 'weighing'.
const openWeighingSession = async (rationCardId, commodity, grams) => {
    const res = await createSessionApi(rationCardId, commodity, grams);
    if (res.status !== 201) return { res, sessionId: null };
    await request(app)
        .post(`/api/dispense/session/${res.body.session_id}/attach`)
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ session_jwt: res.body.session_jwt });
    await dispenseSessionService.beginWeighing(res.body.session_id);
    return { res, sessionId: res.body.session_id };
};

const walletOf = async (rationCardId) => {
    const { rows } = await pool.query(
        `SELECT rice_balance_kg, wheat_balance_kg FROM wallets WHERE ration_card_id = $1`,
        [rationCardId],
    );
    return { rice: Number(rows[0].rice_balance_kg), wheat: Number(rows[0].wheat_balance_kg) };
};

const countsOf = async (rationCardId) => {
    const { rows } = await pool.query(
        `SELECT (SELECT COUNT(*)::int FROM transactions WHERE ration_card_id = $1) tx,
            (SELECT COUNT(*)::int FROM dispense_records WHERE ration_card_id = $1) dr`,
        [rationCardId],
    );
    return rows[0];
};

beforeAll(async () => {
    await pool.query(`
    INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES ('BPL', 3000, 2000)
    ON CONFLICT (category) DO UPDATE SET rice_per_card_grams = EXCLUDED.rice_per_card_grams,
                                         wheat_per_card_grams = EXCLUDED.wheat_per_card_grams
  `);
    const area = await pool.query(
        `INSERT INTO areas (name) VALUES ('CorrArea') ON CONFLICT (name) DO UPDATE SET name='CorrArea' RETURNING id`,
    );
    areaId = area.rows[0].id;

    const sk = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash)
     VALUES ('shopkeeper', 'corr-sk@pds.gov', '+919111222333', $1) RETURNING id`,
        [await bcrypt.hash('pw', 10)],
    );
    shopkeeperId = sk.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shop = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('CORR-001', 'Corr Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shop.rows[0].id;

    await pool.query(`INSERT INTO iot_devices (device_id, device_token_hash, shop_id) VALUES ($1, $2, $3)`, [
        'esp32-corr-01',
        await bcrypt.hash('corr-token', 10),
        shopId,
    ]);
});

afterAll(async () => {
    await pool.end();
});

// ---------------------------------------------------------------- BUG 1 ----
describe('BUG 1 — a session must cover the COMPLETE allocation', () => {
    test('5. allocation 3000 g, session requested for 1000 g -> REJECTED', async () => {
        const { rationCardId } = await seedCard(`b1-partial-${Date.now()}`);
        const res = await createSessionApi(rationCardId, 'rice', 1000);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/complete rice allocation of 3000 g/i);
        expect(res.body.error).toMatch(/not supported/i);

        // nothing was created, nothing was claimed
        const c = await countsOf(rationCardId);
        expect(c.tx).toBe(0);
        expect(c.dr).toBe(0);
        expect(await getClaimedCommodities(pool, rationCardId)).toEqual([]);
        expect((await walletOf(rationCardId)).rice).toBe(3);
    });

    test('allocation 3000 g, session requested for 3000 g -> ALLOWED', async () => {
        const { rationCardId } = await seedCard(`b1-full-${Date.now()}`);
        const res = await createSessionApi(rationCardId, 'rice', RICE_ALLOC);
        expect(res.status).toBe(201);
    });

    test('an over-allocation request is rejected too (not clamped)', async () => {
        const { rationCardId } = await seedCard(`b1-over-${Date.now()}`);
        const res = await createSessionApi(rationCardId, 'rice', 3500);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/complete rice allocation of 3000 g/i);
    });

    test('6. entitled_grams cannot be set client-side — the stored value is derived', async () => {
        const { rationCardId } = await seedCard(`b1-derived-${Date.now()}`);
        const res = await createSessionApi(rationCardId, 'rice', RICE_ALLOC);
        expect(res.status).toBe(201);

        const { rows } = await pool.query(`SELECT entitled_grams, tolerance_grams FROM dispense_sessions WHERE id = $1`, [
            res.body.session_id,
        ]);
        expect(rows[0].entitled_grams).toBe(RICE_ALLOC);
        expect(rows[0].tolerance_grams).toBe(RICE_TOL);
    });

    test('wheat uses its own allocation, independently of rice', async () => {
        const { rationCardId } = await seedCard(`b1-wheat-${Date.now()}`);
        expect((await createSessionApi(rationCardId, 'wheat', RICE_ALLOC)).status).toBe(400); // rice's figure
        expect((await createSessionApi(rationCardId, 'wheat', WHEAT_ALLOC)).status).toBe(201);
    });

    test('the manual path enforces the same invariant (BUG 1 is not bypassable)', async () => {
        const { rationCardId, headUserId } = await seedCard(`b1-manual-${Date.now()}`);
        const qr = await makeQr(rationCardId, headUserId);
        const res = await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: qr, rice_qty_kg: 1, wheat_qty_kg: 0 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/complete rice allocation/i);
        expect((await countsOf(rationCardId)).tx).toBe(0);
        expect((await walletOf(rationCardId)).rice).toBe(3);
    });

    test('the manual path still accepts the complete allocation', async () => {
        const { rationCardId, headUserId } = await seedCard(`b1-manual-ok-${Date.now()}`);
        const qr = await makeQr(rationCardId, headUserId);
        const res = await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: qr, rice_qty_kg: 3, wheat_qty_kg: 2 });

        expect(res.status).toBe(200);
        expect(await walletOf(rationCardId)).toEqual({ rice: 0, wheat: 0 });
    });
});

// ---------------------------------------------------------------- BUG 2 ----
describe('BUG 2 — the wallet is debited the AUTHORISED allocation', () => {
    test('1. 3000 entitled / 3000 measured -> success, wallet to 0.00', async () => {
        const { rationCardId } = await seedCard(`b2-exact-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        const r = await dispenseSessionService.commitSession(sessionId, 3000);

        expect(r.success).toBe(true);
        expect((await walletOf(rationCardId)).rice).toBe(0);
    });

    test('2. 3000 entitled / 2990 measured (underfill in tolerance) -> success, NO stranded balance', async () => {
        const { rationCardId } = await seedCard(`b2-under-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        const r = await dispenseSessionService.commitSession(sessionId, 2990);

        expect(r.success).toBe(true);
        // the whole allocation is discharged — previously this left 0.01 kg
        expect((await walletOf(rationCardId)).rice).toBe(0);

        const tx = await pool.query(`SELECT rice_qty_kg FROM transactions WHERE ration_card_id = $1`, [rationCardId]);
        const dr = await pool.query(
            `SELECT entitled_grams, measured_grams FROM dispense_records WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(Number(tx.rows[0].rice_qty_kg)).toBe(3); // authorised business quantity
        expect(dr.rows[0].entitled_grams).toBe(3000);
        expect(dr.rows[0].measured_grams).toBe(2990); // physical truth preserved
    });

    test('3. 3000 entitled / 3010 measured (overfill in tolerance) -> success, wallet never over-debited', async () => {
        const { rationCardId } = await seedCard(`b2-over-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        const r = await dispenseSessionService.commitSession(sessionId, 3010);

        // this used to fail with insufficient_balance
        expect(r.success).toBe(true);
        expect((await walletOf(rationCardId)).rice).toBe(0);

        const tx = await pool.query(`SELECT rice_qty_kg FROM transactions WHERE ration_card_id = $1`, [rationCardId]);
        const dr = await pool.query(`SELECT measured_grams FROM dispense_records WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        // tolerance is not extra entitlement: 3.00 kg debited, 3010 g recorded
        expect(Number(tx.rows[0].rice_qty_kg)).toBe(3);
        expect(dr.rows[0].measured_grams).toBe(3010);
    });

    test('no wallet can go negative', async () => {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int n FROM wallets WHERE rice_balance_kg < 0 OR wheat_balance_kg < 0`,
        );
        expect(rows[0].n).toBe(0);
    });
});

// ---------------------------------------------------------------- BUG 3 ----
describe('BUG 3 — tolerance enforced at the commit boundary', () => {
    test('4 & 7. commitSession called directly with 3040 g (tolerance 30) -> REJECTED', async () => {
        const { rationCardId } = await seedCard(`b3-over-tol-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);

        const r = await dispenseSessionService.commitSession(sessionId, 3040);
        expect(r.success).toBe(false);
        expect(r.reason).toBe('out_of_tolerance');
    });

    test('a far-under measurement (2400 g) is rejected — this used to commit', async () => {
        const { rationCardId } = await seedCard(`b3-under-tol-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);

        const r = await dispenseSessionService.commitSession(sessionId, 2400);
        expect(r.success).toBe(false);
        expect(r.reason).toBe('out_of_tolerance');
    });

    test('8 & 9. a rejected commit mutates nothing at all', async () => {
        const { rationCardId } = await seedCard(`b3-nomutate-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);

        const before = await walletOf(rationCardId);
        const r = await dispenseSessionService.commitSession(sessionId, 3500);
        expect(r.success).toBe(false);

        expect(await walletOf(rationCardId)).toEqual(before); // no debit
        const c = await countsOf(rationCardId);
        expect(c.tx).toBe(0); // no transaction
        expect(c.dr).toBe(0); // no dispense_record
        expect(await getClaimedCommodities(pool, rationCardId)).toEqual([]); // no claim

        const st = await pool.query(`SELECT state FROM dispense_sessions WHERE id = $1`, [sessionId]);
        expect(st.rows[0].state).toBe('failed_out_of_tolerance');
    });

    test('the boundary measurement (exactly at tolerance) is accepted', async () => {
        const { rationCardId } = await seedCard(`b3-boundary-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        const r = await dispenseSessionService.commitSession(sessionId, RICE_ALLOC + RICE_TOL);
        expect(r.success).toBe(true);
    });
});

// ------------------------------------------------------------ INVARIANTS ----
describe('end-to-end invariants', () => {
    test('10. one successful IoT dispense -> exactly one of everything', async () => {
        const { rationCardId } = await seedCard(`inv-one-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        expect((await dispenseSessionService.commitSession(sessionId, 2995)).success).toBe(true);

        const c = await countsOf(rationCardId);
        expect(c.tx).toBe(1);
        expect(c.dr).toBe(1);
        expect((await walletOf(rationCardId)).rice).toBe(0);
        expect(await getClaimedCommodities(pool, rationCardId)).toEqual(['rice']);

        const dr = await pool.query(
            `SELECT transaction_id, row_hash FROM dispense_records WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(dr.rows[0].transaction_id).toBeTruthy(); // canonical link intact
        expect(dr.rows[0].row_hash).toBeTruthy(); // hash chain intact
    });

    test('11. retrying the same session -> no second debit, no second transaction', async () => {
        const { rationCardId } = await seedCard(`inv-retry-${Date.now()}`);
        const { sessionId } = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        expect((await dispenseSessionService.commitSession(sessionId, 3000)).success).toBe(true);

        const retry = await dispenseSessionService.commitSession(sessionId, 3000);
        expect(retry.success).toBe(false);
        expect(retry.reason).toMatch(/invalid_state/);

        const c = await countsOf(rationCardId);
        expect(c.tx).toBe(1);
        expect(c.dr).toBe(1);
        expect((await walletOf(rationCardId)).rice).toBe(0);
    });

    test('12. rice and wheat remain independent, each complete in one transaction', async () => {
        const { rationCardId } = await seedCard(`inv-both-${Date.now()}`);

        const rice = await openWeighingSession(rationCardId, 'rice', RICE_ALLOC);
        expect((await dispenseSessionService.commitSession(rice.sessionId, 3000)).success).toBe(true);

        const wheat = await openWeighingSession(rationCardId, 'wheat', WHEAT_ALLOC);
        expect((await dispenseSessionService.commitSession(wheat.sessionId, 1995)).success).toBe(true);

        expect(await walletOf(rationCardId)).toEqual({ rice: 0, wheat: 0 });
        expect(await getClaimedCommodities(pool, rationCardId)).toEqual(['rice', 'wheat']);
        const c = await countsOf(rationCardId);
        expect(c.tx).toBe(2);
        expect(c.dr).toBe(2);
    });
});
