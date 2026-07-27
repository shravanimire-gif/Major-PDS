require('./setup');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { Pool } = require('pg');
require('dotenv').config();

const deviceRegistryService = require('../src/services/deviceRegistryService');

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
let adminToken, shopId;

beforeAll(async () => {
    const adminRes = await pool.query(`INSERT INTO users (role, email, password_hash) VALUES ('admin', 'grace-admin@test.com', 'x') RETURNING id`);
    adminToken = jwt.sign({ id: adminRes.rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    const areaRes = await pool.query(`INSERT INTO areas (name) VALUES ('GraceArea') RETURNING id`);
    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('GRACE-001', 'Grace Test Shop', $1) RETURNING id`,
        [areaRes.rows[0].id],
    );
    shopId = shopRes.rows[0].id;
});

afterAll(async () => {
    await pool.end();
});

describe('Token rotation grace window', () => {
    it('accepts both the old and new token within the grace window, rejects the old one once it expires', async () => {
        const registerRes = await request(app)
            .post('/api/admin/iot/devices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ device_id: 'esp32-grace-001', shop_id: shopId });
        expect(registerRes.status).toBe(201);
        const originalToken = registerRes.body.token;

        const rotateRes = await request(app)
            .post('/api/admin/iot/devices/esp32-grace-001/rotate-token')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(rotateRes.status).toBe(200);
        const newToken = rotateRes.body.token;
        expect(newToken).not.toBe(originalToken);

        const oldStillWorks = await deviceRegistryService.validateToken('esp32-grace-001', originalToken);
        expect(oldStillWorks.ok).toBe(true);

        const newWorks = await deviceRegistryService.validateToken('esp32-grace-001', newToken);
        expect(newWorks.ok).toBe(true);

        // Simulate the 5-minute grace window having elapsed.
        await pool.query(
            `UPDATE iot_devices SET previous_token_expires_at = NOW() - INTERVAL '1 minute' WHERE device_id = $1`,
            ['esp32-grace-001'],
        );

        const oldNowRejected = await deviceRegistryService.validateToken('esp32-grace-001', originalToken);
        expect(oldNowRejected.ok).toBe(false);
        expect(oldNowRejected.reason).toBe('invalid_token');

        const newStillWorks = await deviceRegistryService.validateToken('esp32-grace-001', newToken);
        expect(newStillWorks.ok).toBe(true);
    });
});
