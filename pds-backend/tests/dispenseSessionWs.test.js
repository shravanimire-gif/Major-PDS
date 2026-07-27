require('./setup');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { attachWebSocketServers } = require('../src/ws/attachSockets');
const dispenseSessionService = require('../src/services/dispenseSessionService');
const { Pool } = require('pg');
require('dotenv').config();

jest.setTimeout(20000);

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

let server, port, shopId, areaId, shopkeeperToken, shopkeeperId;
let deviceId, deviceRawToken;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (checkFn, { timeoutMs = 8000, intervalMs = 100 } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = await checkFn();
        if (result) return result;
        await sleep(intervalMs);
    }
    throw new Error('waitFor: condition not met before timeout');
};

const connectDevice = (devId, token) =>
    new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/iot?deviceId=${devId}`, [token]);
        const timer = setTimeout(() => {
            reject(new Error('connectDevice: timed out waiting for the WS handshake to complete'));
        }, 5000);
        const settle = (fn) => (...args) => {
            clearTimeout(timer);
            fn(...args);
        };
        ws.on('open', settle(() => resolve(ws)));
        // A rejected upgrade (e.g. bad auth) gets a plain HTTP response, not
        // a 101 — the `ws` client surfaces that as 'unexpected-response', not
        // 'error', so both must be handled or a bad token hangs forever.
        ws.on('unexpected-response', settle((req, res) => {
            reject(new Error(`connectDevice: unexpected response ${res.statusCode}`));
        }));
        ws.on('error', settle(reject));
    });

const sendReading = (ws, grams, ts = Date.now()) =>
    ws.send(JSON.stringify({ type: 'reading', grams, ts, sessionId: null }));

const seedRationCardWithWallet = async ({ cardNumber, riceKg }) => {
    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id) VALUES ($1, 'BPL', $2, $3) RETURNING id`,
        [cardNumber, shopId, areaId],
    );
    await pool.query(`INSERT INTO wallets (ration_card_id, rice_balance_kg) VALUES ($1, $2)`, [
        rcRes.rows[0].id,
        riceKg,
    ]);
    return rcRes.rows[0].id;
};

const seedQrSession = async (rationCardId) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    await pool.query(
        `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, expires_at) VALUES ($1, $2, $3, $4)`,
        [sessionId, rationCardId, shopId, new Date(Date.now() + 60000)],
    );
    return sessionId;
};

const createAndAttachSession = async ({ rationCardId, entitledGrams }) => {
    const qrSessionId = await seedQrSession(rationCardId);
    const createRes = await request(app)
        .post('/api/dispense/session')
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ ration_card_id: rationCardId, commodity: 'rice', entitled_grams: entitledGrams, qr_session_id: qrSessionId });
    expect(createRes.status).toBe(201);

    const attachRes = await request(app)
        .post(`/api/dispense/session/${createRes.body.session_id}/attach`)
        .set('Authorization', `Bearer ${shopkeeperToken}`)
        .send({ session_jwt: createRes.body.session_jwt });
    expect(attachRes.status).toBe(200);

    return createRes.body.session_id;
};

beforeAll(async () => {
    await pool.query(
        `INSERT INTO policies (category, rice_per_person_kg, wheat_per_person_kg, sugar_per_person_kg) VALUES
      ('BPL', 5.00, 3.00, 1.00)
     ON CONFLICT (category) DO UPDATE SET rice_per_person_kg = EXCLUDED.rice_per_person_kg`,
    );

    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('DispenseWsArea') ON CONFLICT (name) DO UPDATE SET name='DispenseWsArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const hash = await bcrypt.hash('shoppass', 10);
    const skRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash) VALUES ('shopkeeper', 'ws-sk@test.com', '+919444444444', $1) RETURNING id`,
        [hash],
    );
    shopkeeperId = skRes.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('WS-001', 'WS Test Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shopRes.rows[0].id;

    deviceId = 'esp32-ws-test-01';
    deviceRawToken = 'ws-test-raw-token';
    const tokenHash = await bcrypt.hash(deviceRawToken, 10);
    await pool.query(`INSERT INTO iot_devices (device_id, device_token_hash, shop_id) VALUES ($1, $2, $3)`, [
        deviceId,
        tokenHash,
        shopId,
    ]);

    server = http.createServer(app);
    attachWebSocketServers(server);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
});

afterAll(async () => {
    await Promise.race([
        new Promise((resolve) => server.close(resolve)),
        sleep(3000), // don't let a lingering socket hang the whole suite
    ]);
    await pool.end();
});

describe('IoT-gated dispense — happy path (readings -> auto-confirm -> committed)', () => {
    it('commits with a correct hash chain, NULL blockchain_tx_hash, and a wallet debit', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-WS-HAPPY', riceKg: 15 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 5000 });

        const ws = await connectDevice(deviceId, deviceRawToken);

        // >=15 readings within the 3s stability window, tightly clustered at
        // the entitled amount — satisfies the auto-confirm rule immediately.
        for (let i = 0; i < 20; i++) {
            sendReading(ws, 5000);
            await sleep(20);
        }

        const committedSession = await waitFor(async () => {
            const res = await pool.query('SELECT state FROM dispense_sessions WHERE id = $1', [sessionId]);
            return res.rows[0].state === 'committed' ? res.rows[0] : null;
        });
        expect(committedSession.state).toBe('committed');

        const recordRes = await pool.query('SELECT * FROM dispense_records WHERE session_id = $1', [sessionId]);
        expect(recordRes.rows.length).toBe(1);
        const record = recordRes.rows[0];
        expect(record.measured_grams).toBeGreaterThanOrEqual(4995);
        expect(record.measured_grams).toBeLessThanOrEqual(5005);
        expect(record.row_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(record.blockchain_tx_hash).toBeNull(); // no BLOCKCHAIN_* env in test -> recordDispense no-ops

        const walletRes = await pool.query('SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1', [
            rationCardId,
        ]);
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBeCloseTo(10, 1); // 15kg - 5kg

        ws.close();
    });

    it('links prev_hash to the previous record in the same shop\'s chain', async () => {
        const firstChainRow = (
            await pool.query(
                `SELECT row_hash FROM dispense_records WHERE shop_id = $1 ORDER BY committed_at DESC LIMIT 1`,
                [shopId],
            )
        ).rows[0];

        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-WS-CHAIN2', riceKg: 15 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 3000 });
        const ws = await connectDevice(deviceId, deviceRawToken);

        for (let i = 0; i < 20; i++) {
            sendReading(ws, 3000);
            await sleep(20);
        }

        await waitFor(async () => {
            const res = await pool.query('SELECT state FROM dispense_sessions WHERE id = $1', [sessionId]);
            return res.rows[0].state === 'committed';
        });

        const newRecord = (await pool.query('SELECT prev_hash FROM dispense_records WHERE session_id = $1', [sessionId]))
            .rows[0];
        expect(newRecord.prev_hash).toBe(firstChainRow.row_hash);

        ws.close();
    });
});

describe('IoT-gated dispense — device disconnect mid-session', () => {
    it('moves the session to device_lost with no partial commit', async () => {
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-WS-LOST', riceKg: 15 });
        const sessionId = await createAndAttachSession({ rationCardId, entitledGrams: 5000 });

        const ws = await connectDevice(deviceId, deviceRawToken);
        sendReading(ws, 100); // nowhere near stable/in-tolerance
        await sleep(200);
        ws.close();

        const lostSession = await waitFor(async () => {
            const res = await pool.query('SELECT state FROM dispense_sessions WHERE id = $1', [sessionId]);
            return res.rows[0].state === 'device_lost' ? res.rows[0] : null;
        });
        expect(lostSession.state).toBe('device_lost');

        const recordRes = await pool.query('SELECT * FROM dispense_records WHERE session_id = $1', [sessionId]);
        expect(recordRes.rows.length).toBe(0);
    });
});

describe('IoT-gated dispense — insufficient-balance race', () => {
    it('commits exactly one of two concurrent commits against a shared wallet; the other fails cleanly', async () => {
        // 5kg available; two sessions each asking for 4kg — only one can win.
        const rationCardId = await seedRationCardWithWallet({ cardNumber: 'BPL-WS-RACE', riceKg: 5 });

        const sessionAId = await createAndAttachSession({ rationCardId, entitledGrams: 4000 });
        // A second session on the same wallet needs its own attach — but
        // attach requires the shop's *available* device, and a device can
        // only usefully gate one session's readings at a time in real
        // operation. The race being tested here is specifically the
        // wallet-debit concurrency guard inside commitSession, independent
        // of the device-attach mechanics, so session B is driven directly
        // through the state machine via SQL instead of a second real attach.
        const qrSessionIdB = await seedQrSession(rationCardId);
        const createBRes = await request(app)
            .post('/api/dispense/session')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, commodity: 'rice', entitled_grams: 4000, qr_session_id: qrSessionIdB });
        expect(createBRes.status).toBe(201);
        const sessionBId = createBRes.body.session_id;
        await pool.query(`UPDATE dispense_sessions SET state = 'weighing' WHERE id = $1`, [sessionBId]);

        // Bring session A into 'weighing' too (it's currently 'attached').
        await pool.query(`UPDATE dispense_sessions SET state = 'weighing' WHERE id = $1`, [sessionAId]);

        const [resultA, resultB] = await Promise.all([
            dispenseSessionService.commitSession(sessionAId, 4000),
            dispenseSessionService.commitSession(sessionBId, 4000),
        ]);

        const successes = [resultA, resultB].filter((r) => r.success);
        const failures = [resultA, resultB].filter((r) => !r.success);
        expect(successes.length).toBe(1);
        expect(failures.length).toBe(1);
        expect(failures[0].reason).toBe('insufficient_balance');

        const failedSessionId = resultA.success ? sessionBId : sessionAId;
        const failedSessionRow = await pool.query('SELECT state FROM dispense_sessions WHERE id = $1', [
            failedSessionId,
        ]);
        expect(failedSessionRow.rows[0].state).toBe('failed_insufficient_balance');

        const walletRes = await pool.query('SELECT rice_balance_kg FROM wallets WHERE ration_card_id = $1', [
            rationCardId,
        ]);
        expect(Number(walletRes.rows[0].rice_balance_kg)).toBeCloseTo(1, 1); // 5kg - 4kg, only once
    });
});

describe('IoT-gated dispense — sanity-ceiling spikes', () => {
    it('drops out-of-range readings and flags needs_recalibration after 3 within 60s', async () => {
        const ws = await connectDevice(deviceId, deviceRawToken);

        for (let i = 0; i < 3; i++) {
            sendReading(ws, 15000); // >10000g ceiling
            await sleep(50);
        }

        const flagged = await waitFor(async () => {
            const res = await pool.query('SELECT needs_recalibration FROM iot_devices WHERE device_id = $1', [
                deviceId,
            ]);
            return res.rows[0].needs_recalibration ? res.rows[0] : null;
        });
        expect(flagged.needs_recalibration).toBe(true);

        // None of the spikes were persisted as sensor_readings.
        const readingsRes = await pool.query(
            'SELECT COUNT(*)::int AS count FROM sensor_readings WHERE device_id = $1 AND grams_int = 15000',
            [deviceId],
        );
        expect(readingsRes.rows[0].count).toBe(0);

        ws.close();

        // Reset the flag so it doesn't leak into other tests/manual smoke checks.
        await pool.query(`UPDATE iot_devices SET needs_recalibration = false WHERE device_id = $1`, [deviceId]);
    });
});
