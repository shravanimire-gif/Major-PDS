require("./setup");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();

const deviceRegistryService = require("../src/services/deviceRegistryService");

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const RAW_TOKEN_ACTIVE = "active-device-raw-token";
const RAW_TOKEN_EXPIRED = "expired-device-raw-token";
const RAW_TOKEN_REVOKED = "revoked-device-raw-token";

let shopId;

beforeAll(async () => {
    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('IoT Test Area') ON CONFLICT (name) DO UPDATE SET name = 'IoT Test Area' RETURNING id`,
    );
    const areaId = areaRes.rows[0].id;

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id) VALUES ('IOT-001', 'IoT Test Shop', $1)
     ON CONFLICT (shop_code) DO UPDATE SET shop_name = 'IoT Test Shop' RETURNING id`,
        [areaId],
    );
    shopId = shopRes.rows[0].id;

    const insertDevice = async (deviceId, rawToken, { status = "active", expiresAt = null } = {}) => {
        const tokenHash = await bcrypt.hash(rawToken, 10);
        await pool.query(
            `INSERT INTO iot_devices (device_id, device_token_hash, shop_id, status, token_expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (device_id) DO UPDATE SET
         device_token_hash = EXCLUDED.device_token_hash,
         status = EXCLUDED.status,
         token_expires_at = EXCLUDED.token_expires_at`,
            [deviceId, tokenHash, shopId, status, expiresAt],
        );
    };

    await insertDevice("esp32-active-01", RAW_TOKEN_ACTIVE);
    await insertDevice("esp32-expired-01", RAW_TOKEN_EXPIRED, {
        expiresAt: new Date(Date.now() - 60 * 1000),
    });
    await insertDevice("esp32-revoked-01", RAW_TOKEN_REVOKED, { status: "revoked" });
});

afterAll(async () => {
    await pool.end();
});

describe("deviceRegistryService.validateToken", () => {
    it("accepts a valid, active, unexpired token", async () => {
        const result = await deviceRegistryService.validateToken("esp32-active-01", RAW_TOKEN_ACTIVE);
        expect(result.ok).toBe(true);
        expect(result.device.device_id).toBe("esp32-active-01");
        expect(result.device.shop_id).toBe(shopId);
    });

    it("rejects an expired token", async () => {
        const result = await deviceRegistryService.validateToken("esp32-expired-01", RAW_TOKEN_EXPIRED);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("expired");
    });

    it("rejects a revoked device", async () => {
        const result = await deviceRegistryService.validateToken("esp32-revoked-01", RAW_TOKEN_REVOKED);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("revoked");
    });

    it("rejects an unknown device_id", async () => {
        const result = await deviceRegistryService.validateToken("esp32-does-not-exist", "whatever-token");
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("unknown");
    });

    it("rejects a wrong token for a known, active device", async () => {
        const result = await deviceRegistryService.validateToken("esp32-active-01", "totally-wrong-token");
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("invalid_token");
    });
});
