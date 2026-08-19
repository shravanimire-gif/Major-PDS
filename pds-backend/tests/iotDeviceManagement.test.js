require('./setup');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { attachWebSocketServers } = require('../src/ws/attachSockets');
const deviceRegistryService = require('../src/services/deviceRegistryService');
const deviceConnectionRegistry = require('../src/services/deviceConnectionRegistry');
const { Pool } = require('pg');
require('dotenv').config();

jest.setTimeout(30000);

/**
 * Device management + USB/serial integration.
 *
 * Covers the surfaces the physical ESP32 work added or changed: registration,
 * assignment/unassignment, enable/disable, the admin device list, and the frame
 * types the USB bridge sends (hello / heartbeat / error). Also pins the
 * device -> shop -> session invariant that stops a device authorising itself for
 * a shop it is not assigned to.
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

let server;
let port;
let areaId;
let shopA;
let shopB;
let inactiveShop;
let shopkeeperAId;
let shopkeeperAToken;
let adminToken;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (checkFn, { timeoutMs = 8000, intervalMs = 50, label = 'condition' } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = await checkFn();
        if (result) return result;
        await sleep(intervalMs);
    }
    throw new Error(`waitFor: ${label} not met before timeout`);
};

const registerDeviceRow = async (deviceId, rawToken, { shopId = null, status = 'active' } = {}) => {
    const tokenHash = await bcrypt.hash(rawToken, 10);
    await pool.query(
        `INSERT INTO iot_devices (device_id, device_token_hash, shop_id, status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (device_id) DO UPDATE SET
       device_token_hash = EXCLUDED.device_token_hash,
       shop_id = EXCLUDED.shop_id,
       status = EXCLUDED.status`,
        [deviceId, tokenHash, shopId, status],
    );
};

// A shop nobody else in this file has touched. The registry enforces one active
// device per shop, so tests that assign a device must not compete for the same
// shop — otherwise they pass or fail depending on execution order.
let freshShopCounter = 0;
const createFreshShop = async () => {
    freshShopCounter += 1;
    const code = `DMX-${String(freshShopCounter).padStart(3, '0')}`;
    const res = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ($1, $2, $3) RETURNING id`,
        [code, `Dev Mgmt Fresh Shop ${freshShopCounter}`, areaId],
    );
    return res.rows[0].id;
};

const connectDevice = (devId, token) =>
    new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/iot?deviceId=${encodeURIComponent(devId)}`, [token]);
        const timer = setTimeout(() => reject(new Error('connectDevice: handshake timed out')), 5000);
        const settle = (fn) => (...args) => {
            clearTimeout(timer);
            fn(...args);
        };
        ws.on('open', settle(() => resolve(ws)));
        // A rejected upgrade is a plain HTTP response, not a 101 — `ws` reports
        // that as 'unexpected-response', so it must be handled explicitly or a
        // refused device hangs the test forever.
        ws.on('unexpected-response', settle((req, res) => {
            const err = new Error(`unexpected response ${res.statusCode}`);
            err.statusCode = res.statusCode;
            reject(err);
        }));
        ws.on('error', settle(reject));
    });

const closeSocket = async (ws) => {
    if (!ws) return;
    await new Promise((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) return resolve();
        ws.on('close', resolve);
        ws.close();
        setTimeout(resolve, 1500);
    });
};

beforeAll(async () => {
    await pool.query(
        `INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams)
     VALUES ('BPL', 3000, 2000)
     ON CONFLICT (category) DO UPDATE SET rice_per_card_grams = EXCLUDED.rice_per_card_grams`,
    );
    await pool.query(
        `INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct)
     VALUES ('rice', 20, 1.00), ('wheat', 20, 1.00)
     ON CONFLICT (commodity) DO UPDATE SET min_tolerance_grams = EXCLUDED.min_tolerance_grams`,
    );

    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('DevMgmtArea') ON CONFLICT (name) DO UPDATE SET name='DevMgmtArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const hash = await bcrypt.hash('pass', 10);

    const adminRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash, name)
     VALUES ('admin','devmgmt-admin@test.com','+919111100001',$1,'Dev Mgmt Admin') RETURNING id`,
        [hash],
    );
    adminToken = jwt.sign({ id: adminRes.rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    const skARes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash, name)
     VALUES ('shopkeeper','devmgmt-sk-a@test.com','+919111100002',$1,'Keeper A') RETURNING id`,
        [hash],
    );
    shopkeeperAId = skARes.rows[0].id;
    shopkeeperAToken = jwt.sign({ id: shopkeeperAId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const skBRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash, name)
     VALUES ('shopkeeper','devmgmt-sk-b@test.com','+919111100003',$1,'Keeper B') RETURNING id`,
        [hash],
    );

    const shopARes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id)
     VALUES ('DM-001','Dev Mgmt Shop A',$1,$2) RETURNING id`,
        [areaId, shopkeeperAId],
    );
    shopA = shopARes.rows[0].id;

    const shopBRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id)
     VALUES ('DM-002','Dev Mgmt Shop B',$1,$2) RETURNING id`,
        [areaId, skBRes.rows[0].id],
    );
    shopB = shopBRes.rows[0].id;

    const inactiveRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, is_active)
     VALUES ('DM-003','Dev Mgmt Closed Shop',$1,false) RETURNING id`,
        [areaId],
    );
    inactiveShop = inactiveRes.rows[0].id;

    server = http.createServer(app);
    attachWebSocketServers(server);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
});

afterAll(async () => {
    await Promise.race([new Promise((resolve) => server.close(resolve)), sleep(3000)]);
    await pool.end();
});

beforeEach(() => {
    deviceRegistryService._resetLastSeenThrottle();
});

// ---------------------------------------------------------------------------

describe('POST /api/admin/iot/devices — registration', () => {
    it('registers a device with a shop and returns the plaintext token exactly once', async () => {
        const res = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ device_id: 'ESP32-REG001', device_name: 'Counter scale', shop_id: shopA });

        expect(res.status).toBe(201);
        expect(res.body.device.device_id).toBe('ESP32-REG001');
        expect(res.body.device.device_name).toBe('Counter scale');
        expect(res.body.device.shop_id).toBe(shopA);
        expect(res.body.token).toMatch(/^[0-9a-f]{64}$/);

        // Only the hash is persisted — the response above is the sole chance to
        // capture the credential.
        const row = await pool.query(`SELECT device_token_hash FROM iot_devices WHERE device_id = 'ESP32-REG001'`);
        expect(row.rows[0].device_token_hash).not.toBe(res.body.token);
        expect(await bcrypt.compare(res.body.token, row.rows[0].device_token_hash)).toBe(true);
    });

    it('registers a device with NO shop (register now, assign later)', async () => {
        const res = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ device_id: 'ESP32-UNASSIGNED' });

        expect(res.status).toBe(201);
        expect(res.body.device.shop_id).toBeNull();
    });

    it('rejects a duplicate device UID', async () => {
        const res = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ device_id: 'ESP32-REG001', shop_id: shopB });
        expect(res.status).toBe(409);
    });

    it('rejects a shop that does not exist', async () => {
        const res = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ device_id: 'ESP32-NOSHOP', shop_id: crypto.randomUUID() });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/does not exist/);
    });

    it('rejects an inactive shop', async () => {
        const res = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ device_id: 'ESP32-CLOSEDSHOP', shop_id: inactiveShop });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not active/);
    });

    it('requires an admin', async () => {
        const res = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${shopkeeperAToken}`)
            .send({ device_id: 'ESP32-SHOPKEEPER', shop_id: shopA });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/admin/iot/devices — the admin device list', () => {
    it('returns the shop, the shop-s shopkeeper, connectivity and the latest reading', async () => {
        await registerDeviceRow('ESP32-LIST01', 'list-token', { shopId: shopA });
        await pool.query(
            `INSERT INTO sensor_readings (device_id, grams_int, taken_at) VALUES ('ESP32-LIST01', 2478, NOW())`,
        );

        const res = await request(app).get('/api/admin/iot/devices').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);

        const device = res.body.devices.find((d) => d.device_id === 'ESP32-LIST01');
        expect(device.shop_name).toBe('Dev Mgmt Shop A');
        expect(device.shop_code).toBe('DM-001');
        expect(device.shopkeeper_name).toBe('Keeper A');
        expect(device.shopkeeper_email).toBe('devmgmt-sk-a@test.com');
        expect(device.current_weight_grams).toBe(2478);
        expect(device.current_weight_at).toBeTruthy();
    });

    it('reports connectivity OFFLINE for a registered device with no live connection', async () => {
        // A healthy row in PostgreSQL is not evidence that anything is plugged in.
        await registerDeviceRow('ESP32-NEVERSEEN', 'nvr-token', { shopId: shopB });
        const res = await request(app).get('/api/admin/iot/devices').set('Authorization', `Bearer ${adminToken}`);
        const device = res.body.devices.find((d) => d.device_id === 'ESP32-NEVERSEEN');
        expect(device.connectivity).toBe('offline');
        expect(device.last_seen_at).toBeNull();
    });

    it('includes an unassigned device rather than dropping it on the shop join', async () => {
        await registerDeviceRow('ESP32-ORPHAN', 'orphan-token', { shopId: null });
        const res = await request(app).get('/api/admin/iot/devices').set('Authorization', `Bearer ${adminToken}`);
        const device = res.body.devices.find((d) => d.device_id === 'ESP32-ORPHAN');
        expect(device).toBeDefined();
        expect(device.shop_id).toBeNull();
        expect(device.shop_name).toBeNull();
    });

    it('never returns a token or a token hash', async () => {
        const res = await request(app).get('/api/admin/iot/devices').set('Authorization', `Bearer ${adminToken}`);
        const serialised = JSON.stringify(res.body);
        expect(serialised).not.toMatch(/device_token_hash/);
        expect(serialised).not.toMatch(/previous_token_hash/);
        expect(serialised).not.toMatch(/\$2[aby]\$/); // a bcrypt hash prefix
    });
});

describe('GET /api/admin/iot/fleet — unassigned devices still appear', () => {
    it('lists a device with no shop', async () => {
        await registerDeviceRow('ESP32-FLEETORPHAN', 'fleet-orphan', { shopId: null });
        const res = await request(app).get('/api/admin/iot/fleet').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        const device = res.body.devices.find((d) => d.device_id === 'ESP32-FLEETORPHAN');
        expect(device).toBeDefined();
        expect(device.shop_id).toBeNull();
        expect(device.status).toBe('offline');
    });
});

describe('PATCH /api/admin/iot/devices/:deviceId/assignment', () => {
    it('assigns an unassigned device to a shop', async () => {
        const targetShop = await createFreshShop();
        await registerDeviceRow('ESP32-ASSIGN01', 'assign-token', { shopId: null });

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-ASSIGN01/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: targetShop });

        expect(res.status).toBe(200);
        expect(res.body.device.shop_id).toBe(targetShop);
    });

    it('unassigns a device when shop_id is explicitly null', async () => {
        await registerDeviceRow('ESP32-UNASSIGN01', 'unassign-token', { shopId: shopB });

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-UNASSIGN01/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: null });

        expect(res.status).toBe(200);
        expect(res.body.device.shop_id).toBeNull();
    });

    it('rejects a request with no shop_id field at all', async () => {
        // "unassign" and "malformed request" must not be the same thing — one of
        // them would otherwise silently unassign a live scale.
        await registerDeviceRow('ESP32-NOFIELD', 'nofield-token', { shopId: shopB });
        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-NOFIELD/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({});
        expect(res.status).toBe(400);

        const row = await pool.query(`SELECT shop_id FROM iot_devices WHERE device_id = 'ESP32-NOFIELD'`);
        expect(row.rows[0].shop_id).toBe(shopB);
    });

    it('rejects an unknown device', async () => {
        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-GHOST/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: shopA });
        expect(res.status).toBe(404);
    });

    it('rejects an inactive shop', async () => {
        await registerDeviceRow('ESP32-TOCLOSED', 'toclosed-token', { shopId: null });
        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-TOCLOSED/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: inactiveShop });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not active/);
    });

    it('refuses to give a shop a second active device', async () => {
        // attachSession picks the shop's active device with LIMIT 1, so two of
        // them would make which device gates a session non-deterministic.
        await registerDeviceRow('ESP32-FIRST', 'first-token', { shopId: shopB });
        await registerDeviceRow('ESP32-SECOND', 'second-token', { shopId: null });

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-SECOND/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: shopB });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already has an active device/);
    });

    it('refuses to reassign a device that is mid-dispense', async () => {
        await registerDeviceRow('ESP32-MIDDISPENSE', 'mid-token', { shopId: shopA });

        const rcRes = await pool.query(
            `INSERT INTO ration_cards (card_number, category, shop_id, area_id)
       VALUES ('BPL-MID-001','BPL',$1,$2) RETURNING id`,
            [shopA, areaId],
        );
        await pool.query(
            `INSERT INTO dispense_sessions (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, expires_at, state, device_id)
       VALUES ($1,$2,'rice',3000,30,NOW() + INTERVAL '1 minute','weighing','ESP32-MIDDISPENSE')`,
            [shopA, rcRes.rows[0].id],
        );

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-MIDDISPENSE/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: shopB });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/mid-dispense/);

        // And the assignment genuinely did not change.
        const row = await pool.query(`SELECT shop_id FROM iot_devices WHERE device_id = 'ESP32-MIDDISPENSE'`);
        expect(row.rows[0].shop_id).toBe(shopA);

        await pool.query(`UPDATE dispense_sessions SET state='cancelled' WHERE device_id='ESP32-MIDDISPENSE'`);
    });

    it('drops the device-s live connection so the change takes effect immediately', async () => {
        const rawToken = 'live-reassign-token';
        await registerDeviceRow('ESP32-LIVEMOVE', rawToken, { shopId: shopA });

        const ws = await connectDevice('ESP32-LIVEMOVE', rawToken);
        await waitFor(() => deviceConnectionRegistry.isOnline('ESP32-LIVEMOVE'), { label: 'device online' });

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-LIVEMOVE/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: null });

        expect(res.status).toBe(200);
        expect(res.body.disconnected).toBe(true);
        await waitFor(() => !deviceConnectionRegistry.isOnline('ESP32-LIVEMOVE'), { label: 'device dropped' });
        await closeSocket(ws);
    });

    it('records the change in the audit log', async () => {
        const targetShop = await createFreshShop();
        await registerDeviceRow('ESP32-AUDITED', 'audited-token', { shopId: null });
        await request(app)
            .patch('/api/admin/iot/devices/ESP32-AUDITED/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: targetShop });

        const audit = await waitFor(
            async () => {
                const res = await pool.query(
                    `SELECT action, target FROM iot_audit WHERE target = 'ESP32-AUDITED' AND action = 'assign_device'`,
                );
                return res.rows[0] || null;
            },
            { label: 'assign_device audit row' },
        );
        expect(audit.action).toBe('assign_device');
    });
});

describe('An unassigned device cannot connect at all', () => {
    it('validateToken reports reason "unassigned"', async () => {
        const rawToken = 'inert-token';
        await registerDeviceRow('ESP32-INERT', rawToken, { shopId: null });

        const result = await deviceRegistryService.validateToken('ESP32-INERT', rawToken);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('unassigned');
    });

    it('the /ws/iot handshake refuses it with a 401', async () => {
        const rawToken = 'inert-ws-token';
        await registerDeviceRow('ESP32-INERTWS', rawToken, { shopId: null });

        await expect(connectDevice('ESP32-INERTWS', rawToken)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('and starts working the moment it is assigned, with no other change', async () => {
        const targetShop = await createFreshShop();
        const rawToken = 'inert-then-assigned';
        await registerDeviceRow('ESP32-LATERASSIGN', rawToken, { shopId: null });
        await expect(connectDevice('ESP32-LATERASSIGN', rawToken)).rejects.toMatchObject({ statusCode: 401 });

        const assignRes = await request(app)
            .patch('/api/admin/iot/devices/ESP32-LATERASSIGN/assignment')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ shop_id: targetShop });
        expect(assignRes.status).toBe(200);

        const ws = await connectDevice('ESP32-LATERASSIGN', rawToken);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        await closeSocket(ws);
    });
});

describe('PATCH /api/admin/iot/devices/:deviceId/status — enable / disable', () => {
    it('disables a device and drops its live connection', async () => {
        const rawToken = 'disable-token';
        await registerDeviceRow('ESP32-DISABLE', rawToken, { shopId: shopB });

        const ws = await connectDevice('ESP32-DISABLE', rawToken);
        await waitFor(() => deviceConnectionRegistry.isOnline('ESP32-DISABLE'), { label: 'online' });

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-DISABLE/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'inactive' });

        expect(res.status).toBe(200);
        expect(res.body.device.status).toBe('inactive');
        expect(res.body.disconnected).toBe(true);
        await closeSocket(ws);

        // A disabled device also cannot come back.
        await expect(connectDevice('ESP32-DISABLE', rawToken)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('re-enables a disabled device', async () => {
        const rawToken = 'enable-token';
        await registerDeviceRow('ESP32-ENABLE', rawToken, { shopId: shopB, status: 'inactive' });

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-ENABLE/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'active' });
        expect(res.status).toBe(200);

        const ws = await connectDevice('ESP32-ENABLE', rawToken);
        expect(ws.readyState).toBe(WebSocket.OPEN);
        await closeSocket(ws);
    });

    it('refuses to disable a device that is mid-dispense', async () => {
        await registerDeviceRow('ESP32-BUSYDISABLE', 'busy-token', { shopId: shopA });

        const rcRes = await pool.query(
            `INSERT INTO ration_cards (card_number, category, shop_id, area_id)
       VALUES ('BPL-BUSY-001','BPL',$1,$2) RETURNING id`,
            [shopA, areaId],
        );
        await pool.query(
            `INSERT INTO dispense_sessions (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, expires_at, state, device_id)
       VALUES ($1,$2,'rice',3000,30,NOW() + INTERVAL '1 minute','confirming','ESP32-BUSYDISABLE')`,
            [shopA, rcRes.rows[0].id],
        );

        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-BUSYDISABLE/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'inactive' });

        expect(res.status).toBe(409);
        const row = await pool.query(`SELECT status FROM iot_devices WHERE device_id='ESP32-BUSYDISABLE'`);
        expect(row.rows[0].status).toBe('active');

        await pool.query(`UPDATE dispense_sessions SET state='cancelled' WHERE device_id='ESP32-BUSYDISABLE'`);
    });

    it('allows enabling while a session is open (no disconnect involved)', async () => {
        await registerDeviceRow('ESP32-ENABLEBUSY', 'enablebusy-token', { shopId: shopA, status: 'inactive' });
        const res = await request(app)
            .patch('/api/admin/iot/devices/ESP32-ENABLEBUSY/status')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'active' });
        expect(res.status).toBe(200);
    });
});

describe('USB bridge frame types over /ws/iot', () => {
    it('records the firmware version reported in a hello frame', async () => {
        const rawToken = 'hello-token';
        await registerDeviceRow('ESP32-HELLO', rawToken, { shopId: shopB });
        const ws = await connectDevice('ESP32-HELLO', rawToken);

        ws.send(JSON.stringify({ type: 'hello', deviceId: 'ESP32-HELLO', firmware: '2.0.0-serial', transport: 'serial' }));

        const row = await waitFor(
            async () => {
                const res = await pool.query(
                    `SELECT firmware_version FROM iot_devices WHERE device_id='ESP32-HELLO'`,
                );
                return res.rows[0].firmware_version ? res.rows[0] : null;
            },
            { label: 'firmware_version to be recorded' },
        );
        expect(row.firmware_version).toBe('2.0.0-serial');
        await closeSocket(ws);
    });

    it('ignores a hello frame that tries to assert business state', async () => {
        // A device must never be able to name its own shop or session; those
        // fields are not in the schema, so Joi rejects the whole frame.
        const rawToken = 'hello-evil-token';
        await registerDeviceRow('ESP32-HELLOEVIL', rawToken, { shopId: shopB });
        const ws = await connectDevice('ESP32-HELLOEVIL', rawToken);

        ws.send(
            JSON.stringify({
                type: 'hello',
                deviceId: 'ESP32-HELLOEVIL',
                firmware: '9.9.9',
                shopId: shopA,
                entitledGrams: 4000,
            }),
        );
        await sleep(400);

        const row = await pool.query(
            `SELECT firmware_version, shop_id FROM iot_devices WHERE device_id='ESP32-HELLOEVIL'`,
        );
        expect(row.rows[0].firmware_version).toBeNull();
        expect(row.rows[0].shop_id).toBe(shopB);
        await closeSocket(ws);
    });

    it('advances last_seen_at on a heartbeat without persisting a reading', async () => {
        const rawToken = 'heartbeat-token';
        await registerDeviceRow('ESP32-HEARTBEAT', rawToken, { shopId: shopB });
        await pool.query(`UPDATE iot_devices SET last_seen_at = NULL WHERE device_id='ESP32-HEARTBEAT'`);

        const ws = await connectDevice('ESP32-HEARTBEAT', rawToken);
        // The connect itself stamps last_seen_at; clear it again so the
        // heartbeat is unambiguously the thing being measured.
        await sleep(200);
        await pool.query(`UPDATE iot_devices SET last_seen_at = NULL WHERE device_id='ESP32-HEARTBEAT'`);
        deviceRegistryService._resetLastSeenThrottle('ESP32-HEARTBEAT');

        ws.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));

        const row = await waitFor(
            async () => {
                const res = await pool.query(
                    `SELECT last_seen_at FROM iot_devices WHERE device_id='ESP32-HEARTBEAT'`,
                );
                return res.rows[0].last_seen_at ? res.rows[0] : null;
            },
            { label: 'last_seen_at refresh' },
        );
        expect(row.last_seen_at).toBeTruthy();

        // A heartbeat is not a measurement — sensor_readings is the measurement
        // log and must stay empty for this device.
        const readings = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sensor_readings WHERE device_id='ESP32-HEARTBEAT'`,
        );
        expect(readings.rows[0].n).toBe(0);
        await closeSocket(ws);
    });

    it('logs a hardware error frame without persisting it as a weight', async () => {
        const rawToken = 'overload-token';
        await registerDeviceRow('ESP32-OVERLOAD', rawToken, { shopId: shopB });
        const ws = await connectDevice('ESP32-OVERLOAD', rawToken);

        ws.send(JSON.stringify({ type: 'error', code: 'OVERLOAD', ts: Date.now(), detail: '5210 g exceeds 5000 g' }));

        // The fault feeds the recalibration signal...
        await waitFor(
            async () => {
                const res = await pool.query(
                    `SELECT COUNT(*)::int AS n FROM sensor_reading_rejections WHERE device_id='ESP32-OVERLOAD'`,
                );
                return res.rows[0].n > 0;
            },
            { label: 'rejection to be logged' },
        );

        // ...but never becomes a measurement.
        const readings = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sensor_readings WHERE device_id='ESP32-OVERLOAD'`,
        );
        expect(readings.rows[0].n).toBe(0);
        await closeSocket(ws);
    });

    it('drops an unknown frame type without closing the socket', async () => {
        const rawToken = 'unknown-frame-token';
        await registerDeviceRow('ESP32-UNKNOWNFRAME', rawToken, { shopId: shopB });
        const ws = await connectDevice('ESP32-UNKNOWNFRAME', rawToken);

        ws.send(JSON.stringify({ type: 'dispense', grams: 3000, sessionId: 'whatever' }));
        ws.send('not json at all');
        ws.send(JSON.stringify({ type: 'reading' })); // missing grams
        await sleep(400);

        expect(ws.readyState).toBe(WebSocket.OPEN);
        const readings = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sensor_readings WHERE device_id='ESP32-UNKNOWNFRAME'`,
        );
        expect(readings.rows[0].n).toBe(0);
        await closeSocket(ws);
    });

    it('rejects a negative reading and an over-rating reading, and persists neither', async () => {
        const rawToken = 'range-token';
        await registerDeviceRow('ESP32-RANGE', rawToken, { shopId: shopB });
        const ws = await connectDevice('ESP32-RANGE', rawToken);

        ws.send(JSON.stringify({ type: 'reading', grams: -350, ts: Date.now() }));
        ws.send(JSON.stringify({ type: 'reading', grams: 5200, ts: Date.now() }));
        ws.send(JSON.stringify({ type: 'reading', grams: 2500.5, ts: Date.now() }));
        await sleep(500);

        const readings = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sensor_readings WHERE device_id='ESP32-RANGE'`,
        );
        expect(readings.rows[0].n).toBe(0);

        // Each out-of-range reading feeds needs_recalibration — the point of
        // forwarding rather than swallowing them in the bridge.
        const rejections = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sensor_reading_rejections WHERE device_id='ESP32-RANGE'`,
        );
        expect(rejections.rows[0].n).toBeGreaterThanOrEqual(2);
        await closeSocket(ws);
    });

    it('accepts a valid reading and stamps it with the shop-s device', async () => {
        const rawToken = 'valid-reading-token';
        await registerDeviceRow('ESP32-VALIDREAD', rawToken, { shopId: shopB });
        const ws = await connectDevice('ESP32-VALIDREAD', rawToken);

        ws.send(JSON.stringify({ type: 'reading', grams: 2487, ts: Date.now() }));

        const reading = await waitFor(
            async () => {
                const res = await pool.query(
                    `SELECT grams_int, session_id FROM sensor_readings WHERE device_id='ESP32-VALIDREAD'`,
                );
                return res.rows[0] || null;
            },
            { label: 'reading to be persisted' },
        );
        expect(reading.grams_int).toBe(2487);
        // No active session, so no session attribution — and crucially no
        // transaction, no dispense_record and no wallet debit.
        expect(reading.session_id).toBeNull();

        const tx = await pool.query(`SELECT COUNT(*)::int AS n FROM transactions WHERE shop_id = $1`, [shopB]);
        expect(tx.rows[0].n).toBe(0);
        await closeSocket(ws);
    });
});

describe('touchLastSeenThrottled', () => {
    it('writes once, then suppresses until the interval elapses', async () => {
        await registerDeviceRow('ESP32-THROTTLE', 'throttle-token', { shopId: shopB });
        deviceRegistryService._resetLastSeenThrottle('ESP32-THROTTLE');

        expect(deviceRegistryService.touchLastSeenThrottled('ESP32-THROTTLE')).toBe(true);
        // At 10 Hz an UPDATE per reading would be pure write amplification for a
        // field whose consumer tolerates minutes of staleness.
        expect(deviceRegistryService.touchLastSeenThrottled('ESP32-THROTTLE')).toBe(false);
        expect(deviceRegistryService.touchLastSeenThrottled('ESP32-THROTTLE')).toBe(false);

        deviceRegistryService._resetLastSeenThrottle('ESP32-THROTTLE');
        expect(deviceRegistryService.touchLastSeenThrottled('ESP32-THROTTLE')).toBe(true);
    });

    it('throttles per device, not globally', async () => {
        await registerDeviceRow('ESP32-THR-A', 'thr-a', { shopId: shopA });
        await registerDeviceRow('ESP32-THR-B', 'thr-b', { shopId: null });
        deviceRegistryService._resetLastSeenThrottle();

        expect(deviceRegistryService.touchLastSeenThrottled('ESP32-THR-A')).toBe(true);
        expect(deviceRegistryService.touchLastSeenThrottled('ESP32-THR-B')).toBe(true);
    });
});

describe('recordFirmwareVersion', () => {
    it('writes a new version and skips a no-op rewrite', async () => {
        await registerDeviceRow('ESP32-FWVER', 'fw-token', { shopId: shopB });
        await pool.query(`UPDATE iot_devices SET firmware_version = NULL WHERE device_id='ESP32-FWVER'`);

        expect(await deviceRegistryService.recordFirmwareVersion('ESP32-FWVER', '2.0.0-serial')).toBe(true);
        // A reconnecting device reporting the same version must not churn the row.
        expect(await deviceRegistryService.recordFirmwareVersion('ESP32-FWVER', '2.0.0-serial')).toBe(false);
        expect(await deviceRegistryService.recordFirmwareVersion('ESP32-FWVER', '2.1.0-serial')).toBe(true);
    });

    it('ignores an empty firmware string', async () => {
        expect(await deviceRegistryService.recordFirmwareVersion('ESP32-FWVER', '')).toBe(false);
        expect(await deviceRegistryService.recordFirmwareVersion('ESP32-FWVER', null)).toBe(false);
    });
});

describe('GET /api/dispense/device-status — what the shopkeeper screen sees', () => {
    it('reports the shop-s device as OFFLINE when nothing is connected', async () => {
        await pool.query(`UPDATE iot_devices SET shop_id = NULL WHERE shop_id = $1`, [shopA]);
        await registerDeviceRow('ESP32-SKSTATUS', 'sk-status-token', { shopId: shopA });
        await pool.query(`UPDATE iot_devices SET last_seen_at = NULL WHERE device_id='ESP32-SKSTATUS'`);

        const res = await request(app)
            .get('/api/dispense/device-status')
            .set('Authorization', `Bearer ${shopkeeperAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.active).toBe(true);
        expect(res.body.connectivity).toBe('offline');
    });

    it('reports ONLINE once the bridge connects', async () => {
        const rawToken = 'sk-online-token';
        await pool.query(`UPDATE iot_devices SET shop_id = NULL WHERE shop_id = $1`, [shopA]);
        await registerDeviceRow('ESP32-SKONLINE', rawToken, { shopId: shopA });

        const ws = await connectDevice('ESP32-SKONLINE', rawToken);
        await waitFor(() => deviceConnectionRegistry.isOnline('ESP32-SKONLINE'), { label: 'online' });

        const res = await request(app)
            .get('/api/dispense/device-status')
            .set('Authorization', `Bearer ${shopkeeperAToken}`);

        expect(res.body.active).toBe(true);
        expect(res.body.connectivity).toBe('online');
        expect(res.body.device_id).toBe('ESP32-SKONLINE');
        await closeSocket(ws);
    });

    it('never exposes a device token or any serial detail to the shopkeeper', async () => {
        const res = await request(app)
            .get('/api/dispense/device-status')
            .set('Authorization', `Bearer ${shopkeeperAToken}`);

        const serialised = JSON.stringify(res.body);
        expect(serialised).not.toMatch(/token/i);
        expect(serialised).not.toMatch(/COM\d/);
        expect(serialised).not.toMatch(/baud/i);
    });
});

describe('GET /api/shopkeeper/beneficiary/:id — allocation is server-resolved', () => {
    it('returns the card-s authoritative per-commodity allocation', async () => {
        await pool.query(`UPDATE iot_devices SET shop_id = NULL WHERE shop_id = $1`, [shopA]);

        const rcRes = await pool.query(
            `INSERT INTO ration_cards (card_number, category, shop_id, area_id)
       VALUES ('BPL-ALLOC-001','BPL',$1,$2) RETURNING id`,
            [shopA, areaId],
        );
        const rationCardId = rcRes.rows[0].id;
        await pool.query(`INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg) VALUES ($1,3,2)`, [
            rationCardId,
        ]);

        const beneficiaryRes = await pool.query(
            `INSERT INTO users (role, email, mobile, password_hash, name)
       VALUES ('beneficiary','alloc-benef@test.com','+919111100009','x','Alloc Head') RETURNING id`,
        );
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, is_head, age)
       VALUES ($1,$2,'Alloc Head',true,40)`,
            [rationCardId, beneficiaryRes.rows[0].id],
        );

        const qrSessionId = crypto.randomBytes(16).toString('hex');
        await pool.query(
            `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
            [qrSessionId, rationCardId, shopA, beneficiaryRes.rows[0].id, new Date(Date.now() + 60000)],
        );

        const res = await request(app)
            .get(`/api/shopkeeper/beneficiary/${rationCardId}`)
            .query({ sessionId: qrSessionId })
            .set('Authorization', `Bearer ${shopkeeperAToken}`);

        expect(res.status).toBe(200);
        // BPL policy: 3000 g rice / 2000 g wheat per card. Not per person — the
        // household's family size must not multiply it.
        expect(res.body.allocation).toEqual({
            category: 'BPL',
            rice_grams: 3000,
            wheat_grams: 2000,
            rice_kg: 3,
            wheat_kg: 2,
        });
    });
});
