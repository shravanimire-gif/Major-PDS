require('./setup');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const dispenseSessionService = require('../src/services/dispenseSessionService');
const analyticsService = require('../src/services/analyticsService');
const activityFeedService = require('../src/services/activityFeedService');
const { runAnomalyDetection } = require('../src/jobs/anomalyDetectionCron');
const { Pool } = require('pg');
require('dotenv').config();

jest.setTimeout(30000);

// Regression suite for the IoT-visibility fix: a committed IoT dispense must
// enter the SAME canonical `transactions` population that manual dispensing
// uses, exactly once, while keeping its dispense_records audit row and
// hash chain. Asserting only that dispense_records got a row is precisely the
// blind spot that let this bug exist, so every assertion here goes through a
// business surface (analytics / activity feed / anomaly detection / wallet).
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

let shopId, areaId, shopkeeperId, shopkeeperToken, deviceId;

const seedRationCardWithWallet = async ({ cardNumber, riceKg = 3, wheatKg = 2 }) => {
    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ($1, 'BPL', $2, $3) RETURNING id`,
        [cardNumber, shopId, areaId],
    );
    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg) VALUES ($1, $2, $3)`,
        [rcRes.rows[0].id, riceKg, wheatKg],
    );
    return rcRes.rows[0].id;
};

const createAndAttachSession = async ({ rationCardId, commodity = 'rice', entitledGrams }) => {
    const qrSessionId = crypto.randomBytes(16).toString('hex');
    await pool.query(
        `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, expires_at) VALUES ($1, $2, $3, $4)`,
        [qrSessionId, rationCardId, shopId, new Date(Date.now() + 60000)],
    );

    const createRes = await request(app)
        .post('/api/dispense/session')
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ ration_card_id: rationCardId, commodity, entitled_grams: entitledGrams, qr_session_id: qrSessionId });
    expect(createRes.status).toBe(201);

    const attachRes = await request(app)
        .post(`/api/dispense/session/${createRes.body.session_id}/attach`)
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ session_jwt: createRes.body.session_jwt });
    expect(attachRes.status).toBe(200);

    // attach leaves the session 'attached'; commitSession accepts
    // weighing/confirming, which the WS reading loop would normally set.
    await dispenseSessionService.beginWeighing(createRes.body.session_id);
    return createRes.body.session_id;
};

beforeAll(async () => {
    await pool.query(
        `INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES
      ('BPL', 3000, 2000)
    
     ON CONFLICT (category) DO UPDATE SET rice_per_card_grams = EXCLUDED.rice_per_card_grams`,
    );

    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('IoTVisibilityArea') ON CONFLICT (name) DO UPDATE SET name='IoTVisibilityArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const skRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash) VALUES ('shopkeeper', 'iotvis-sk@test.com', '+919555555555', $1) RETURNING id`,
        [await bcrypt.hash('shoppass', 10)],
    );
    shopkeeperId = skRes.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('IOTVIS-001', 'IoT Visibility Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shopRes.rows[0].id;

    deviceId = 'esp32-iotvis-01';
    await pool.query(`INSERT INTO iot_devices (device_id, device_token_hash, shop_id) VALUES ($1, $2, $3)`, [
        deviceId,
        await bcrypt.hash('iotvis-token', 10),
        shopId,
    ]);
});

afterAll(async () => {
    await pool.end();
});

describe('a committed IoT dispense becomes a canonical transaction', () => {
    it('creates exactly one transaction, one dispense_record, one wallet debit — and links them', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-1', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        const before = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(before.rows[0].c).toBe(0);

        const result = await dispenseSessionService.commitSession(sessionId, 3000);
        expect(result.success).toBe(true);
        expect(result.transactionId).toBeDefined();

        // exactly one of each
        const tx = await pool.query(
            `SELECT id, rice_qty_kg, wheat_qty_kg, served_by, shop_id FROM transactions WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(tx.rows).toHaveLength(1);
        expect(Number(tx.rows[0].rice_qty_kg)).toBe(3);
        expect(Number(tx.rows[0].wheat_qty_kg)).toBe(0);
        expect(tx.rows[0].served_by).toBe(shopkeeperId);
        expect(tx.rows[0].shop_id).toBe(shopId);

        const dr = await pool.query(
            `SELECT id, transaction_id, measured_grams, row_hash FROM dispense_records WHERE session_id = $1`,
            [sessionId],
        );
        expect(dr.rows).toHaveLength(1);
        expect(dr.rows[0].measured_grams).toBe(3000);
        expect(dr.rows[0].row_hash).toBeTruthy(); // hash chain preserved

        // the link is real and correlatable in SQL
        expect(dr.rows[0].transaction_id).toBe(tx.rows[0].id);
        const joined = await pool.query(
            `SELECT t.id AS tx_id, d.id AS dr_id, t.rice_qty_kg, d.measured_grams
       FROM transactions t JOIN dispense_records d ON d.transaction_id = t.id
       WHERE t.ration_card_id = $1`,
            [rationCardId],
        );
        expect(joined.rows).toHaveLength(1);
        expect(Number(joined.rows[0].rice_qty_kg) * 1000).toBe(joined.rows[0].measured_grams);

        // wallet debited exactly once: 15 - 4 = 11 (not 7)
        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(0);
    });

    it('is visible to analytics — and counted exactly once, not once per table', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-ANALYTICS', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        expect((await dispenseSessionService.commitSession(sessionId, 3000)).success).toBe(true);

        // Compared against the DB rather than a before/after delta: results
        // are cached for ANALYTICS_CACHE_TTL_MS, and an equality check is the
        // stronger assertion anyway — if the IoT dispense were counted from
        // both `transactions` and `dispense_records`, the analytics total
        // would exceed the canonical transactions total.
        const trend = await analyticsService.getDistributionTrend('30d');
        const analyticsRice = trend.days.reduce((sum, d) => sum + Number(d.rice_kg), 0);

        const { rows } = await pool.query(
            `SELECT COALESCE(SUM(rice_qty_kg), 0)::float AS rice
       FROM transactions WHERE created_at >= date_trunc('day', NOW()) - make_interval(days => 30)`,
        );

        expect(analyticsRice).toBe(rows[0].rice);
        expect(analyticsRice).toBeGreaterThanOrEqual(4); // this dispense is in there
    });

    it('is visible to the activity feed as exactly one dispense event', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-FEED', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        const since = new Date(Date.now() - 60 * 1000);
        expect((await dispenseSessionService.commitSession(sessionId, 3000)).success).toBe(true);

        const feed = await activityFeedService.getActivityFeed({ since, limit: 100 });
        const events = feed.events.filter((e) => e.type === 'dispense');
        const mine = events.filter((e) => e.detail?.rationCardId === rationCardId);

        expect(mine).toHaveLength(1);
        expect(mine[0].detail.riceQtyKg).toBe(3);
        expect(mine[0].refType).toBe('transaction');
    });

    it('is visible to anomaly detection through the existing transactions-based rules', async () => {
        // Uses the SHOP_SPIKE rule, not LARGE_TRANSACTION: a single IoT
        // dispense is capped at the 4 kg per-transaction allocation, so it
        // can never reach the 50 kg
        // large-transaction threshold. Shop-spike is the rule an IoT dispense
        // can genuinely trip, and it proves the same thing — the IoT dispense
        // is part of the transaction population the detector scans.
        //
        // Own shop + shopkeeper so the other tests' dispenses can't perturb
        // this shop's 24h total (getAssignedShop takes one shop per user).
        const skRes = await pool.query(
            `INSERT INTO users (role, email, mobile, password_hash) VALUES ('shopkeeper', 'iotvis-spike@test.com', '+919556666666', $1) RETURNING id`,
            [await bcrypt.hash('shoppass', 10)],
        );
        const spikeSkId = skRes.rows[0].id;
        const spikeSkToken = jwt.sign({ id: spikeSkId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });
        const spikeShopRes = await pool.query(
            `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('IOTVIS-SPK', 'Spike Shop', $1, $2) RETURNING id`,
            [areaId, spikeSkId],
        );
        const spikeShopId = spikeShopRes.rows[0].id;
        // attach requires an active device for the shop
        await pool.query(`INSERT INTO iot_devices (device_id, device_token_hash, shop_id) VALUES ($1, $2, $3)`, [
            'esp32-iotvis-spike-01',
            await bcrypt.hash('spike-token', 10),
            spikeShopId,
        ]);

        // One card per dispense: monthly eligibility is one claim per ration
        // card per commodity per month (migration 025), so a shop-level spike
        // is necessarily spread across several beneficiaries — which is also
        // what a real diversion pattern looks like.
        const spikeCards = [];
        for (let i = 0; i < 7; i += 1) {
            const rc = await pool.query(
                `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ($1, 'BPL', $2, $3) RETURNING id`,
                [`BPL-IOTVIS-SPIKE-${i}`, spikeShopId, areaId],
            );
            spikeCards.push(rc.rows[0].id);
            await pool.query(`INSERT INTO wallets (ration_card_id, rice_balance_kg) VALUES ($1, 100)`, [
                rc.rows[0].id,
            ]);
        }
        const rationCardId = spikeCards[0];

        // Trailing baseline of manual dispenses. Days 2..30 (not 31 — the
        // rule's window edge is computed at query time, so a row inserted at
        // exactly NOW()-31d falls just outside it): 29 x 6 kg / 30 = 5.8
        // kg/day, comfortably above SHOP_SPIKE_MIN_BASELINE_KG (5), giving a
        // spike threshold of 3 x 5.8 = 17.4 kg in the last 24h.
        // One card per baseline transaction. The window spans two calendar
        // months, so reusing a small pool of cards would collide on the
        // monthly-claim index — each historical dispense is its own
        // beneficiary, which is what the shop's trailing volume really is.
        for (let day = 2; day <= 30; day += 1) {
            const rc = await pool.query(
                `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ($1, 'BPL', $2, $3) RETURNING id`,
                [`BPL-IOTVIS-BASE-${day}`, spikeShopId, areaId],
            );
            await pool.query(
                `INSERT INTO transactions (ration_card_id, shop_id, served_by, rice_qty_kg, created_at)
         VALUES ($1, $2, $3, 6, NOW() - make_interval(days => $4::int))`,
                [rc.rows[0].id, spikeShopId, spikeSkId, day],
            );
        }

        // Today: IoT dispenses only. Each is capped at the 4 kg single
        // 3 kg per-card allocation, so it takes 7 of them (21 kg) to clear
        // the 17.4 kg threshold.
        for (let i = 0; i < 7; i += 1) {
            const spikeCardId = spikeCards[i];
            const qrSessionId = crypto.randomBytes(16).toString('hex');
            await pool.query(
                `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, expires_at) VALUES ($1, $2, $3, $4)`,
                [qrSessionId, spikeCardId, spikeShopId, new Date(Date.now() + 60000)],
            );
            const createRes = await request(app)
                .post('/api/dispense/session')
                .set('Authorization', `Bearer ${spikeSkToken}`)
                .send({ ration_card_id: spikeCardId, commodity: 'rice', entitled_grams: 3000, qr_session_id: qrSessionId });
            expect(createRes.status).toBe(201);
            const attachRes = await request(app)
                .post(`/api/dispense/session/${createRes.body.session_id}/attach`)
                .set('Authorization', `Bearer ${spikeSkToken}`)
                .send({ session_jwt: createRes.body.session_jwt });
            expect(attachRes.status).toBe(200);
            await dispenseSessionService.beginWeighing(createRes.body.session_id);
            expect((await dispenseSessionService.commitSession(createRes.body.session_id, 3000)).success).toBe(true);
        }

        await runAnomalyDetection();

        const flagged = await pool.query(
            `SELECT type, severity, description FROM anomaly_events WHERE shop_code = 'IOTVIS-SPK' AND type = 'shop_spike'`,
        );
        expect(flagged.rows.length).toBeGreaterThanOrEqual(1);
        // 20 kg of IoT dispensing is what pushed it over — without the
        // canonical transaction rows the 24h total would have been 0.
        expect(flagged.rows[0].description).toMatch(/21/);
    });
});

describe('idempotency and failure handling', () => {
    it('retrying the same committed session creates no second transaction', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-RETRY', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        const first = await dispenseSessionService.commitSession(sessionId, 3000);
        expect(first.success).toBe(true);

        const retry = await dispenseSessionService.commitSession(sessionId, 3000);
        expect(retry.success).toBe(false);
        expect(retry.reason).toMatch(/invalid_state/);

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        const dr = await pool.query(`SELECT COUNT(*)::int c FROM dispense_records WHERE session_id = $1`, [sessionId]);
        expect(tx.rows[0].c).toBe(1);
        expect(dr.rows[0].c).toBe(1);

        // and only one debit: 15 - 4 = 11
        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(0);
    });

    it('two concurrent commits of one session yield one transaction and one debit', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-RACE', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        const results = await Promise.all([
            dispenseSessionService.commitSession(sessionId, 3000),
            dispenseSessionService.commitSession(sessionId, 3000),
        ]);
        expect(results.filter((r) => r.success)).toHaveLength(1);

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(tx.rows[0].c).toBe(1);

        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(0);
    });

    it('insufficient balance creates no transaction, no dispense_record, no debit', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-NSF', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        // Wallet drained behind the open session's back, so the commit-time
        // balance guard is what rejects it (the measurement is in tolerance —
        // this is not the tolerance guard firing).
        await pool.query(`UPDATE wallets SET rice_balance_kg = 1 WHERE ration_card_id = $1`, [rationCardId]);
        const result = await dispenseSessionService.commitSession(sessionId, 3000);
        expect(result.success).toBe(false);
        expect(result.reason).toBe('insufficient_balance');

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        const dr = await pool.query(`SELECT COUNT(*)::int c FROM dispense_records WHERE session_id = $1`, [sessionId]);
        expect(tx.rows[0].c).toBe(0);
        expect(dr.rows[0].c).toBe(0);

        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(1); // untouched by the failed commit
    });

    it('a cancelled session cannot commit and leaves no business trace', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-CANCEL', riceKg: 3 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });

        await dispenseSessionService.cancelSession(sessionId, shopId);
        const result = await dispenseSessionService.commitSession(sessionId, 3000);
        expect(result.success).toBe(false);

        const tx = await pool.query(`SELECT COUNT(*)::int c FROM transactions WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(tx.rows[0].c).toBe(0);

        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(3);
    });
});

describe('manual dispensing is unchanged', () => {
    it('still produces a transaction with no dispense_record attached', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-IOTVIS-MANUAL', riceKg: 3 });

        const headRes = await pool.query(
            `INSERT INTO users (role, name, mobile) VALUES ('beneficiary', 'Manual Head', '9998887777') RETURNING id`,
        );
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'Manual Head', 40, true)`,
            [rationCardId, headRes.rows[0].id],
        );

        const qrSessionId = crypto.randomBytes(16).toString('hex');
        await pool.query(
            `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
            [qrSessionId, rationCardId, shopId, headRes.rows[0].id, new Date(Date.now() + 60000)],
        );

        const res = await request(app)
            .post('/api/shopkeeper/dispense')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, session_id: qrSessionId, rice_qty_kg: 3, wheat_qty_kg: 0 });

        expect(res.status).toBe(200);
        expect(res.body.remaining_wallet.rice_balance_kg).toBe(0);

        const tx = await pool.query(`SELECT id FROM transactions WHERE ration_card_id = $1`, [rationCardId]);
        expect(tx.rows).toHaveLength(1);

        const dr = await pool.query(`SELECT COUNT(*)::int c FROM dispense_records WHERE transaction_id = $1`, [
            tx.rows[0].id,
        ]);
        expect(dr.rows[0].c).toBe(0);
    });
});
