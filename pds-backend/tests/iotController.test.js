require("./setup");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();

const { persistReading } = require("../src/controllers/iotController");

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const DEVICE_ID = "esp32-reading-test-01";

beforeAll(async () => {
    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('IoT Reading Test Area') ON CONFLICT (name) DO UPDATE SET name = 'IoT Reading Test Area' RETURNING id`,
    );
    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('IOT-READ-001', 'IoT Reading Test Shop', $1)
     ON CONFLICT (shop_code) DO UPDATE SET shop_name = 'IoT Reading Test Shop' RETURNING id`,
        [areaRes.rows[0].id],
    );
    const shopId = shopRes.rows[0].id;

    const tokenHash = await bcrypt.hash("reading-test-raw-token", 10);
    await pool.query(
        `INSERT INTO iot_devices (device_id, device_token_hash, shop_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (device_id) DO UPDATE SET device_token_hash = EXCLUDED.device_token_hash`,
        [DEVICE_ID, tokenHash, shopId],
    );
});

afterAll(async () => {
    await pool.end();
});

describe("iotController.persistReading", () => {
    it("rejects negative grams", async () => {
        const result = await persistReading(DEVICE_ID, -5, null, new Date());
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/range/);
    });

    it("rejects grams above the 10000g sanity ceiling", async () => {
        const result = await persistReading(DEVICE_ID, 10001, null, new Date());
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/range/);
    });

    it("rejects an unknown device_id", async () => {
        const result = await persistReading("esp32-does-not-exist", 1000, null, new Date());
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown device_id/);
    });

    it("persists a valid reading and it can be read back", async () => {
        const takenAt = new Date();
        const result = await persistReading(DEVICE_ID, 4832, null, takenAt);

        expect(result.success).toBe(true);
        expect(result.reading.grams_int).toBe(4832);

        const row = await pool.query(
            `SELECT grams_int, session_id FROM sensor_readings WHERE id = $1`,
            [result.reading.id],
        );
        expect(row.rows[0].grams_int).toBe(4832);
        expect(row.rows[0].session_id).toBeNull();
    });
});
