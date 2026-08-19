require('./setup');
const http = require('http');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { attachWebSocketServers } = require('../src/ws/attachSockets');
const { Pool } = require('pg');
require('dotenv').config();

/**
 * END-TO-END: the REAL IoT bridge against the REAL backend.
 *
 * This runs the actual production bridge classes — iot-bridge/src/bridge.js,
 * backendClient.js, simulatedSource.js — over a real WebSocket to a real
 * Express + ws server, against a real PostgreSQL database, and then checks the
 * whole business chain the dispense is supposed to produce:
 *
 *   readings -> stability -> commit -> wallet debit -> transactions
 *            -> dispense_records -> analytics -> activity feed
 *            -> anomaly detection -> blockchain anchor enqueue
 *
 * The ONLY thing replaced is the physical sensor. Every other hop is the real
 * code path: the same bridge binary the demo runs, the same /ws/iot handshake,
 * the same commitSession transaction, the same tables.
 *
 * WHAT THIS DOES NOT PROVE
 * It says nothing about the HX711 wiring, the load cell's calibration or
 * linearity, or whether the COM port opens. Those are physical facts and only
 * the board can demonstrate them — see scripts/verify-iot-hardware.js, which is
 * the same set of assertions driven by the real device over USB.
 *
 * The bridge modules are required across the package boundary on purpose: this
 * test exists to prove those exact files interoperate with this exact backend.
 * A reimplementation here would only ever test the reimplementation. None of
 * them pull in `serialport`, so no native module is needed.
 */

const BRIDGE_SRC = path.resolve(__dirname, '../../iot-bridge/src');
// eslint-disable-next-line import/no-dynamic-require
const { Bridge } = require(path.join(BRIDGE_SRC, 'bridge.js'));
// eslint-disable-next-line import/no-dynamic-require
const { BackendClient } = require(path.join(BRIDGE_SRC, 'backendClient.js'));
// eslint-disable-next-line import/no-dynamic-require
const { SimulatedSource } = require(path.join(BRIDGE_SRC, 'simulatedSource.js'));

jest.setTimeout(60000);

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// BPL policy for this suite. 3000 g rice per CARD — not per person: family size
// must never multiply an allocation.
const RICE_GRAMS = 3000;
const WHEAT_GRAMS = 2000;

const DEVICE_UID = 'ESP32-E2E001';
const DEVICE_TOKEN = 'e2e-bridge-device-token-0123456789';

let server;
let port;
let areaId;
let shopId;
let shopkeeperId;
let shopkeeperToken;
let bridge;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (checkFn, { timeoutMs = 25000, intervalMs = 100, label = 'condition' } = {}) => {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
        last = await checkFn();
        if (last) return last;
        await sleep(intervalMs);
    }
    throw new Error(`waitFor: ${label} not met before timeout`);
};

const seedBeneficiary = async ({ cardNumber, email, mobile, riceKg = 3, wheatKg = 2 }) => {
    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id)
     VALUES ($1,'BPL',$2,$3) RETURNING id`,
        [cardNumber, shopId, areaId],
    );
    const rationCardId = rcRes.rows[0].id;

    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg) VALUES ($1,$2,$3)`,
        [rationCardId, riceKg, wheatKg],
    );

    const userRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash, name)
     VALUES ('beneficiary',$1,$2,'x','E2E Head') RETURNING id`,
        [email, mobile],
    );
    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, is_head, age)
     VALUES ($1,$2,'E2E Head',true,42)`,
        [rationCardId, userRes.rows[0].id],
    );

    return { rationCardId, beneficiaryUserId: userRes.rows[0].id };
};

const seedQrSession = async (rationCardId, beneficiaryUserId) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    await pool.query(
        `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
        [sessionId, rationCardId, shopId, beneficiaryUserId, new Date(Date.now() + 120000)],
    );
    return sessionId;
};

// Opens and attaches a session exactly the way the shopkeeper screen does:
// entitled_grams comes from the allocation the beneficiary lookup reported, and
// the session is attached to whatever device the backend resolves for the shop.
const openSessionAsShopkeeper = async ({ rationCardId, qrSessionId, commodity, entitledGrams }) => {
    const createRes = await request(app)
        .post('/api/dispense/session')
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({
            ration_card_id: rationCardId,
            commodity,
            entitled_grams: entitledGrams,
            qr_session_id: qrSessionId,
        });
    expect(createRes.status).toBe(201);

    const attachRes = await request(app)
        .post(`/api/dispense/session/${createRes.body.session_id}/attach`)
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ session_jwt: createRes.body.session_jwt });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.device_id).toBe(DEVICE_UID);

    return {
        sessionId: createRes.body.session_id,
        toleranceGrams: createRes.body.tolerance_grams,
    };
};

// The real bridge, wired to the real backend over a real socket.
const startBridge = async ({ targetGrams }) => {
    const config = {
        backendUrl: `http://127.0.0.1:${port}`,
        backendWsPath: '/ws/iot',
        deviceToken: DEVICE_TOKEN,
        deviceId: DEVICE_UID,
        reconnectInitialMs: 50,
        reconnectMaxMs: 200,
        heartbeatMs: 5000,
        serialBaud: 115200,
        serialPort: null,
        simulate: true,
        simulateTargetGrams: targetGrams,
        HARDWARE_MAX_GRAMS: 5000,
    };

    const source = new SimulatedSource(config);
    const client = new BackendClient(config);
    const instance = new Bridge({ config, source, client });
    instance.start();

    await waitFor(() => client.connected, { timeoutMs: 10000, label: 'bridge to authenticate' });
    return instance;
};

const stopBridge = async () => {
    if (bridge) {
        bridge.stop();
        bridge = null;
        await sleep(200);
    }
};

beforeAll(async () => {
    await pool.query(
        `INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams)
     VALUES ('BPL',$1,$2)
     ON CONFLICT (category) DO UPDATE SET
       rice_per_card_grams = EXCLUDED.rice_per_card_grams,
       wheat_per_card_grams = EXCLUDED.wheat_per_card_grams`,
        [RICE_GRAMS, WHEAT_GRAMS],
    );
    await pool.query(
        `INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct)
     VALUES ('rice',20,1.00), ('wheat',20,1.00)
     ON CONFLICT (commodity) DO UPDATE SET
       min_tolerance_grams = EXCLUDED.min_tolerance_grams,
       tolerance_pct = EXCLUDED.tolerance_pct`,
    );

    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('E2EBridgeArea')
     ON CONFLICT (name) DO UPDATE SET name='E2EBridgeArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const hash = await bcrypt.hash('pass', 10);
    const skRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash, name)
     VALUES ('shopkeeper','e2e-bridge-sk@test.com','+919222200001',$1,'E2E Keeper') RETURNING id`,
        [hash],
    );
    shopkeeperId = skRes.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id)
     VALUES ('E2E-001','E2E Bridge Shop',$1,$2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shopRes.rows[0].id;

    const tokenHash = await bcrypt.hash(DEVICE_TOKEN, 10);
    await pool.query(
        `INSERT INTO iot_devices (device_id, device_token_hash, shop_id, device_name)
     VALUES ($1,$2,$3,'E2E bridge scale')`,
        [DEVICE_UID, tokenHash, shopId],
    );

    server = http.createServer(app);
    attachWebSocketServers(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
});

afterEach(async () => {
    await stopBridge();
});

afterAll(async () => {
    await stopBridge();
    await Promise.race([new Promise((resolve) => server.close(resolve)), sleep(3000)]);
    await pool.end();
});

// ---------------------------------------------------------------------------

describe('E2E — one allocation produces ONE complete transaction', () => {
    it('bridge -> backend -> wallet debit + transaction + dispense_record, all consistent', async () => {
        const { rationCardId, beneficiaryUserId } = await seedBeneficiary({
            cardNumber: 'BPL-E2E-HAPPY',
            email: 'e2e-happy@test.com',
            mobile: '+919222200010',
        });

        // The allocation the shopkeeper screen would have been handed.
        const qrForLookup = await seedQrSession(rationCardId, beneficiaryUserId);
        const lookup = await request(app)
            .get(`/api/shopkeeper/beneficiary/${rationCardId}`)
            .query({ sessionId: qrForLookup })
            .set('Authorization', `Bearer ${shopkeeperToken}`);
        expect(lookup.status).toBe(200);
        expect(lookup.body.allocation.rice_grams).toBe(RICE_GRAMS);

        const qrSessionId = await seedQrSession(rationCardId, beneficiaryUserId);
        const { sessionId, toleranceGrams } = await openSessionAsShopkeeper({
            rationCardId,
            qrSessionId,
            commodity: 'rice',
            entitledGrams: lookup.body.allocation.rice_grams,
        });

        // Tolerance is max(20 g, 1% of 3000 g) = 30 g.
        expect(toleranceGrams).toBe(30);

        bridge = await startBridge({ targetGrams: RICE_GRAMS });

        const session = await waitFor(
            async () => {
                const res = await pool.query(`SELECT state FROM dispense_sessions WHERE id = $1`, [sessionId]);
                return res.rows[0].state === 'committed' ? res.rows[0] : null;
            },
            { label: 'session to commit' },
        );
        expect(session.state).toBe('committed');

        // ---- Wallet: debited by the AUTHORISED ALLOCATION, landing on exactly 0.
        const wallet = await pool.query(
            `SELECT rice_balance_kg, wheat_balance_kg FROM wallets WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(0);
        // The other commodity is untouched — a session covers exactly one.
        expect(Number(wallet.rows[0].wheat_balance_kg)).toBe(2);

        // ---- transactions: the canonical business record. Exactly ONE.
        const tx = await pool.query(
            `SELECT id, rice_qty_kg, wheat_qty_kg, served_by, shop_id FROM transactions WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(tx.rows.length).toBe(1);
        expect(Number(tx.rows[0].rice_qty_kg)).toBe(3);
        expect(Number(tx.rows[0].wheat_qty_kg)).toBe(0);
        expect(tx.rows[0].served_by).toBe(shopkeeperId);
        expect(tx.rows[0].shop_id).toBe(shopId);

        // ---- dispense_records: the IoT audit record, linked to that transaction.
        const record = await pool.query(
            `SELECT * FROM dispense_records WHERE session_id = $1`,
            [sessionId],
        );
        expect(record.rows.length).toBe(1);
        expect(record.rows[0].transaction_id).toBe(tx.rows[0].id);
        expect(record.rows[0].entitled_grams).toBe(RICE_GRAMS);
        expect(record.rows[0].row_hash).toMatch(/^[0-9a-f]{64}$/);

        // measured_grams is preserved verbatim for audit, and differs from the
        // entitlement within tolerance — which is the whole point of tolerance.
        const measured = record.rows[0].measured_grams;
        expect(Math.abs(measured - RICE_GRAMS)).toBeLessThanOrEqual(toleranceGrams);

        // ---- The debit is the ALLOCATION, never the measurement. This is the
        // invariant that stops tolerance leaking into entitlement.
        expect(Number(tx.rows[0].rice_qty_kg) * 1000).toBe(RICE_GRAMS);
    });

    it('does NOT split the allocation into multiple passes', async () => {
        const { rationCardId, beneficiaryUserId } = await seedBeneficiary({
            cardNumber: 'BPL-E2E-SINGLE',
            email: 'e2e-single@test.com',
            mobile: '+919222200011',
        });
        const qrSessionId = await seedQrSession(rationCardId, beneficiaryUserId);
        const { sessionId } = await openSessionAsShopkeeper({
            rationCardId,
            qrSessionId,
            commodity: 'rice',
            entitledGrams: RICE_GRAMS,
        });

        bridge = await startBridge({ targetGrams: RICE_GRAMS });
        await waitFor(
            async () => {
                const res = await pool.query(`SELECT state FROM dispense_sessions WHERE id = $1`, [sessionId]);
                return res.rows[0].state === 'committed';
            },
            { label: 'commit' },
        );

        // Keep streaming well past the commit. A multi-pass/accumulator design
        // would produce a second transaction here; there must be exactly one.
        await sleep(3000);

        const tx = await pool.query(
            `SELECT COUNT(*)::int AS n FROM transactions WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(tx.rows[0].n).toBe(1);

        const records = await pool.query(
            `SELECT COUNT(*)::int AS n FROM dispense_records WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(records.rows[0].n).toBe(1);

        // And the wallet is not driven negative by the continued readings.
        const wallet = await pool.query(
            `SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(0);
    });
});

describe('E2E — the IoT transaction is visible to every business surface', () => {
    let rationCardId;
    let transactionId;
    let dispenseRecordId;

    beforeAll(async () => {
        const seeded = await seedBeneficiary({
            cardNumber: 'BPL-E2E-VISIBLE',
            email: 'e2e-visible@test.com',
            mobile: '+919222200012',
        });
        rationCardId = seeded.rationCardId;

        const qrSessionId = await seedQrSession(rationCardId, seeded.beneficiaryUserId);
        const { sessionId } = await openSessionAsShopkeeper({
            rationCardId,
            qrSessionId,
            commodity: 'rice',
            entitledGrams: RICE_GRAMS,
        });

        bridge = await startBridge({ targetGrams: RICE_GRAMS });
        await waitFor(
            async () => {
                const res = await pool.query(
                    `SELECT id, transaction_id FROM dispense_records WHERE session_id = $1`,
                    [sessionId],
                );
                return res.rows[0] || null;
            },
            { label: 'dispense_record' },
        );
        await stopBridge();

        const record = await pool.query(
            `SELECT id, transaction_id FROM dispense_records WHERE session_id = $1`,
            [sessionId],
        );
        dispenseRecordId = record.rows[0].id;
        transactionId = record.rows[0].transaction_id;
    });

    it('analytics counts the IoT dispense exactly once, from `transactions`', async () => {
        const analyticsService = require('../src/services/analyticsService');

        // The REAL analytics query, unchanged by the IoT work. It reads
        // `transactions` and nothing else, which is why an IoT dispense needs no
        // IoT-specific analytics query to appear.
        const trend = await analyticsService.getDistributionTrend('30d');
        const totalRiceKg = trend.days.reduce((sum, day) => sum + Number(day.rice_kg), 0);
        expect(totalRiceKg).toBeGreaterThanOrEqual(3);

        // Counted ONCE, not twice. The IoT path writes one `transactions` row
        // and one `dispense_records` row, joined one-to-one by transaction_id —
        // so a surface reading `transactions` sees a single dispense, and the
        // audit record does not inflate it.
        const counted = await pool.query(
            `SELECT COUNT(*)::int AS n, SUM(rice_qty_kg)::numeric AS rice
         FROM transactions WHERE ration_card_id = $1`,
            [rationCardId],
        );
        expect(counted.rows[0].n).toBe(1);
        expect(Number(counted.rows[0].rice)).toBe(3);

        const joined = await pool.query(
            `SELECT COUNT(*)::int AS n
         FROM transactions t
         JOIN dispense_records dr ON dr.transaction_id = t.id
        WHERE t.ration_card_id = $1`,
            [rationCardId],
        );
        expect(joined.rows[0].n).toBe(1);
    });

    it('the activity feed shows the IoT dispense', async () => {
        const activityFeedService = require('../src/services/activityFeedService');

        const feed = await activityFeedService.getActivityFeed({
            since: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            limit: 100,
        });
        const events = feed.events || feed.activities || feed;
        expect(Array.isArray(events)).toBe(true);

        const entry = events.find(
            (event) => event.type === 'dispense' && event.detail?.transactionId === transactionId,
        );
        expect(entry).toBeDefined();
        expect(entry.detail.riceQtyKg).toBe(3);
        expect(entry.detail.shopName).toBe('E2E Bridge Shop');
    });

    it('anomaly detection sees it as an ordinary transaction', async () => {
        const anomalyRulesService = require('../src/services/anomalyRulesService');

        // The anomaly engine's own input is `transactions`; the row must be
        // present and shaped like every other dispense, IoT or manual.
        const visible = await pool.query(
            `SELECT id, created_at, rice_qty_kg, wheat_qty_kg, shop_id, served_by
         FROM transactions WHERE id = $1`,
            [transactionId],
        );
        expect(visible.rows.length).toBe(1);
        expect(visible.rows[0].created_at).toBeTruthy();
        expect(visible.rows[0].served_by).toBe(shopkeeperId);

        // Running the engine over it must not throw — i.e. an IoT-originated row
        // needs no special handling to be analysable.
        // Resolves (with no value) rather than throwing: an IoT-originated row
        // needs no special handling to be analysable.
        await expect(anomalyRulesService.runAnomalyRules()).resolves.toBeUndefined();
    });

    it('the blockchain anchor path originates from dispense_records', async () => {
        // enqueueAnchor is fired after COMMIT; with no BLOCKCHAIN_* env in test
        // the chain call no-ops, so what is asserted is that the record exists
        // with a verifiable hash and is the anchor source — not that a live
        // chain write happened.
        const record = await pool.query(
            `SELECT row_hash, prev_hash, blockchain_tx_hash, transaction_id
         FROM dispense_records WHERE id = $1`,
            [dispenseRecordId],
        );
        expect(record.rows[0].row_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(record.rows[0].transaction_id).toBe(transactionId);
        expect(record.rows[0].blockchain_tx_hash).toBeNull();
    });

    it('the monthly claim was consumed exactly once', async () => {
        const claims = await pool.query(
            `SELECT COUNT(*)::int AS n FROM transactions
        WHERE ration_card_id = $1 AND rice_qty_kg > 0
          AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
            [rationCardId],
        );
        expect(claims.rows[0].n).toBe(1);
    });
});

describe('E2E — a device cannot be authorised for a shop it is not assigned to', () => {
    it('a session at another shop is never gated by this device', async () => {
        // A second shop with its own beneficiary and its own session. The E2E
        // device belongs to shopId, so it must not be able to advance or commit
        // this other shop's session no matter what it streams.
        const otherKeeper = await pool.query(
            `INSERT INTO users (role, email, mobile, password_hash, name)
       VALUES ('shopkeeper','e2e-other-sk@test.com','+919222200020','x','Other Keeper') RETURNING id`,
        );
        const otherShop = await pool.query(
            `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id)
       VALUES ('E2E-002','E2E Other Shop',$1,$2) RETURNING id`,
            [areaId, otherKeeper.rows[0].id],
        );
        const otherShopId = otherShop.rows[0].id;

        const rcRes = await pool.query(
            `INSERT INTO ration_cards (card_number, category, shop_id, area_id)
       VALUES ('BPL-E2E-OTHER','BPL',$1,$2) RETURNING id`,
            [otherShopId, areaId],
        );
        const otherCardId = rcRes.rows[0].id;
        await pool.query(`INSERT INTO wallets (ration_card_id, rice_balance_kg) VALUES ($1,3)`, [otherCardId]);

        // Created directly, bypassing the shopkeeper API, so the session exists
        // in a weighing state with NO device attached and nothing else to gate it.
        const sessionRes = await pool.query(
            `INSERT INTO dispense_sessions
         (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, expires_at, state)
       VALUES ($1,$2,'rice',$3,30,NOW() + INTERVAL '5 minutes','weighing') RETURNING id`,
            [otherShopId, otherCardId, RICE_GRAMS],
        );
        const otherSessionId = sessionRes.rows[0].id;

        bridge = await startBridge({ targetGrams: RICE_GRAMS });
        // Long enough for the stability window (3 s) plus the confirm countdown
        // (3 s) to have elapsed several times over, if it were ever going to.
        await sleep(9000);

        const state = await pool.query(`SELECT state FROM dispense_sessions WHERE id = $1`, [otherSessionId]);
        expect(state.rows[0].state).toBe('weighing');

        const tx = await pool.query(
            `SELECT COUNT(*)::int AS n FROM transactions WHERE ration_card_id = $1`,
            [otherCardId],
        );
        expect(tx.rows[0].n).toBe(0);

        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            otherCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(3);
    });
});

describe('E2E — readings without a session never create business rows', () => {
    it('streams weight for seconds and writes no transaction, record or debit', async () => {
        const { rationCardId } = await seedBeneficiary({
            cardNumber: 'BPL-E2E-NOSESSION',
            email: 'e2e-nosession@test.com',
            mobile: '+919222200013',
        });

        const txBefore = await pool.query(`SELECT COUNT(*)::int AS n FROM transactions`);
        const recBefore = await pool.query(`SELECT COUNT(*)::int AS n FROM dispense_records`);

        bridge = await startBridge({ targetGrams: RICE_GRAMS });
        await sleep(5000);

        // Sensor readings ARE persisted — that is the live-weight feature.
        const readings = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sensor_readings WHERE device_id = $1`,
            [DEVICE_UID],
        );
        expect(readings.rows[0].n).toBeGreaterThan(0);

        // But a sensor reading is not a dispense.
        const txAfter = await pool.query(`SELECT COUNT(*)::int AS n FROM transactions`);
        const recAfter = await pool.query(`SELECT COUNT(*)::int AS n FROM dispense_records`);
        expect(txAfter.rows[0].n).toBe(txBefore.rows[0].n);
        expect(recAfter.rows[0].n).toBe(recBefore.rows[0].n);

        const wallet = await pool.query(`SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1`, [
            rationCardId,
        ]);
        expect(Number(wallet.rows[0].rice_balance_kg)).toBe(3);
    });
});

describe('E2E — device status reflects real communication', () => {
    it('is ONLINE while the bridge runs and OFFLINE after it stops', async () => {
        const beforeRes = await request(app)
            .get('/api/admin/iot/fleet')
            .set(
                'Authorization',
                `Bearer ${jwt.sign({ id: shopkeeperId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' })}`,
            );
        expect(beforeRes.status).toBe(200);

        bridge = await startBridge({ targetGrams: 0 });

        const adminToken = jwt.sign({ id: shopkeeperId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        const online = await waitFor(
            async () => {
                const res = await request(app)
                    .get('/api/admin/iot/devices')
                    .set('Authorization', `Bearer ${adminToken}`);
                // Asserted, not assumed: a throttled or errored response has no
                // `devices` array, and treating that as "not online yet" would
                // let a broken endpoint pass as a legitimate offline device.
                expect(res.status).toBe(200);
                const device = res.body.devices.find((d) => d.device_id === DEVICE_UID);
                return device?.connectivity === 'online' ? device : null;
            },
            { intervalMs: 300, label: 'device to report ONLINE' },
        );
        expect(online.connectivity).toBe('online');
        expect(online.shop_name).toBe('E2E Bridge Shop');
        expect(online.shopkeeper_name).toBe('E2E Keeper');
        // Firmware version came from the bridge's hello frame, which came from
        // the (simulated) board — never from an admin.
        expect(online.firmware_version).toBe('simulated');
        // Current weight is a sensor reading, present and numeric.
        expect(typeof online.current_weight_grams).toBe('number');

        await stopBridge();

        const offline = await waitFor(
            async () => {
                const res = await request(app)
                    .get('/api/admin/iot/devices')
                    .set('Authorization', `Bearer ${adminToken}`);
                expect(res.status).toBe(200);
                const device = res.body.devices.find((d) => d.device_id === DEVICE_UID);
                // 'stale' is the intermediate state: no live socket, last_seen_at
                // still recent. Either non-online value proves the status is
                // driven by communication rather than by the row existing.
                return device && device.connectivity !== 'online' ? device : null;
            },
            { intervalMs: 300, label: 'device to stop reporting ONLINE' },
        );
        expect(offline.connectivity).not.toBe('online');
        expect(offline.status).toBe('active'); // registry lifecycle is unchanged
    });
});

describe('E2E — bridge recovers from a backend restart', () => {
    it('reconnects and resumes forwarding without operator action', async () => {
        bridge = await startBridge({ targetGrams: 1500 });
        const client = bridge.client;

        await waitFor(() => client.readingsForwarded > 5, { label: 'initial readings' });
        const forwardedBeforeDrop = client.readingsForwarded;

        // Simulate the backend dropping every device socket (what a restart
        // looks like from the bridge's side).
        const { WebSocketServer } = require('ws');
        expect(WebSocketServer).toBeDefined();
        client.ws.terminate();

        await waitFor(() => !client.connected, { label: 'disconnect to be noticed' });
        await waitFor(() => client.connected, { timeoutMs: 15000, label: 'automatic reconnect' });

        await waitFor(() => client.readingsForwarded > forwardedBeforeDrop + 5, {
            label: 'forwarding to resume',
        });
        expect(client.connected).toBe(true);
    });
});
