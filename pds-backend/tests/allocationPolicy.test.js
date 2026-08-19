require('./setup');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../src/app');
const dispenseSessionService = require('../src/services/dispenseSessionService');
const { runEntitlementAllocation } = require('../src/services/entitlementService');
const {
    MAX_DISPENSE_TRANSACTION_GRAMS,
    validateAllocation,
    allocationForPolicy,
    gramsToKg,
    kgToGrams,
    AllocationError,
} = require('../src/services/allocationPolicyService');
const { Pool } = require('pg');
require('dotenv').config();

jest.setTimeout(30000);

// The domain invariant: a household's complete allocation for ONE commodity
// must be deliverable by ONE dispensing transaction. These assert the rule at
// every layer that can produce or consume an allocation — the pure validator,
// the policy table's CHECK constraints, the monthly entitlement run, the
// admin card-creation path, and the IoT session boundary.
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

const PER_CARD = { APL: [2000, 1500], BPL: [3000, 2000], AAY: [4000, 3000] };

let areaId, shopId, shopkeeperId, shopkeeperToken, adminToken;

const seedCard = async (cardNumber, category, memberCount) => {
    const headRes = await pool.query(`INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`);
    const headId = headRes.rows[0].id;
    const rcRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, head_user_id, shop_id, area_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [cardNumber, category, headId, shopId, areaId],
    );
    const rcId = rcRes.rows[0].id;
    await pool.query(
        `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, 'Head', 30, true)`,
        [rcId, headId],
    );
    for (let i = 1; i < memberCount; i += 1) {
        const m = await pool.query(`INSERT INTO users (role) VALUES ('beneficiary') RETURNING id`);
        await pool.query(
            `INSERT INTO family_members (ration_card_id, user_id, name, age, is_head) VALUES ($1, $2, $3, 20, false)`,
            [rcId, m.rows[0].id, `Member${i}`],
        );
    }
    await pool.query(
        `INSERT INTO wallets (ration_card_id, rice_balance_kg, wheat_balance_kg) VALUES ($1, 0, 0)`,
        [rcId],
    );
    return rcId;
};

beforeAll(async () => {
    await pool.query(`
    INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES
      ('APL', 2000, 1500), ('BPL', 3000, 2000), ('AAY', 4000, 3000)
    ON CONFLICT (category) DO UPDATE
      SET rice_per_card_grams = EXCLUDED.rice_per_card_grams,
          wheat_per_card_grams = EXCLUDED.wheat_per_card_grams
  `);

    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('AllocArea') ON CONFLICT (name) DO UPDATE SET name='AllocArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const adminRes = await pool.query(
        `INSERT INTO users (role, email, password_hash) VALUES ('admin', 'alloc-admin@pds.gov', $1) RETURNING id`,
        [await bcrypt.hash('pw', 10)],
    );
    adminToken = jwt.sign({ id: adminRes.rows[0].id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    const skRes = await pool.query(
        `INSERT INTO users (role, email, mobile, password_hash) VALUES ('shopkeeper', 'alloc-sk@pds.gov', '+919777777777', $1) RETURNING id`,
        [await bcrypt.hash('pw', 10)],
    );
    shopkeeperId = skRes.rows[0].id;
    shopkeeperToken = jwt.sign({ id: shopkeeperId, role: 'shopkeeper' }, JWT_SECRET, { expiresIn: '1h' });

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('ALLOC-001', 'Alloc Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shopRes.rows[0].id;

    await pool.query(`INSERT INTO iot_devices (device_id, device_token_hash, shop_id) VALUES ($1, $2, $3)`, [
        'esp32-alloc-01',
        await bcrypt.hash('alloc-token', 10),
        shopId,
    ]);
});

afterAll(async () => {
    await pool.end();
});

describe('the allocation invariant (pure validator)', () => {
    test.each([1000, 2000, 3000, 4000])('%d g is a valid allocation', (grams) => {
        expect(validateAllocation({ commodity: 'rice', category: 'BPL', allocatedGrams: grams })).toBe(grams);
    });

    test.each([4010, 5000, 10000, 20000])('%d g is rejected — exceeds one transaction', (grams) => {
        expect(() => validateAllocation({ commodity: 'rice', category: 'BPL', allocatedGrams: grams })).toThrow(
            AllocationError,
        );
        expect(() => validateAllocation({ commodity: 'rice', category: 'BPL', allocatedGrams: grams })).toThrow(
            /exceeds the 4000 g/,
        );
    });

    test('4001 g is rejected (one gram over the ceiling)', () => {
        expect(() => validateAllocation({ commodity: 'rice', category: 'BPL', allocatedGrams: 4001 })).toThrow(
            AllocationError,
        );
    });

    test.each([0, -1, -4000])('%d g is rejected — allocation must be positive', (grams) => {
        expect(() => validateAllocation({ commodity: 'wheat', category: 'APL', allocatedGrams: grams })).toThrow(
            /greater than 0/,
        );
    });

    test('a non-multiple of 10 g is rejected so grams <-> kg stays lossless', () => {
        expect(() => validateAllocation({ commodity: 'rice', category: 'BPL', allocatedGrams: 3333 })).toThrow(
            /multiple of 10/,
        );
    });

    test('an unsupported commodity is rejected', () => {
        expect(() => validateAllocation({ commodity: 'sugar', category: 'BPL', allocatedGrams: 1000 })).toThrow(
            /Unsupported commodity/,
        );
    });

    test('grams <-> kg round-trips exactly for every policy value', () => {
        for (const [rice, wheat] of Object.values(PER_CARD)) {
            expect(kgToGrams(gramsToKg(rice))).toBe(rice);
            expect(kgToGrams(gramsToKg(wheat))).toBe(wheat);
        }
    });

    test('the ceiling is the configured constant, not a literal', () => {
        expect(MAX_DISPENSE_TRANSACTION_GRAMS).toBe(4000);
    });
});

describe('the policy table enforces the invariant structurally', () => {
    test('a policy above the ceiling cannot be stored at all', async () => {
        await expect(
            pool.query(
                `INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES ('APL', 20000, 1500)
         ON CONFLICT (category) DO UPDATE SET rice_per_card_grams = 20000`,
            ),
        ).rejects.toThrow(/rice_per_card_grams_check/);
    });

    test('a zero or negative policy cannot be stored', async () => {
        await expect(
            pool.query(
                `INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams) VALUES ('BPL', 0, 2000)
         ON CONFLICT (category) DO UPDATE SET rice_per_card_grams = 0`,
            ),
        ).rejects.toThrow(/rice_per_card_grams_check/);
    });

    test('every seeded category is within the ceiling', async () => {
        const { rows } = await pool.query(
            `SELECT category, rice_per_card_grams, wheat_per_card_grams FROM policies ORDER BY category`,
        );
        expect(rows.length).toBeGreaterThanOrEqual(3);
        for (const row of rows) {
            expect(row.rice_per_card_grams).toBeLessThanOrEqual(MAX_DISPENSE_TRANSACTION_GRAMS);
            expect(row.wheat_per_card_grams).toBeLessThanOrEqual(MAX_DISPENSE_TRANSACTION_GRAMS);
            expect(row.rice_per_card_grams).toBeGreaterThan(0);
            expect(row.wheat_per_card_grams).toBeGreaterThan(0);
        }
    });

    test('category differentiation survives — the three categories still differ', async () => {
        const { rows } = await pool.query(
            `SELECT category, rice_per_card_grams FROM policies WHERE category IN ('APL','BPL','AAY')`,
        );
        const byCat = Object.fromEntries(rows.map((r) => [r.category, r.rice_per_card_grams]));
        expect(byCat.APL).toBeLessThan(byCat.BPL);
        expect(byCat.BPL).toBeLessThan(byCat.AAY);
    });
});

describe('entitlement run — every category, every family size', () => {
    beforeEach(async () => {
        await pool.query(
            `TRUNCATE TABLE transactions, wallets, family_members, ration_cards RESTART IDENTITY CASCADE`,
        );
    });

    const cases = [];
    for (const category of ['APL', 'BPL', 'AAY']) {
        for (const familySize of [1, 2, 4, 6, 9]) {
            cases.push([category, familySize]);
        }
    }

    test.each(cases)('%s card with family size %d allocates the per-card figure', async (category, familySize) => {
        await seedCard(`${category}-FS${familySize}`, category, familySize);
        await pool.query(`UPDATE wallets SET last_reset_date = NULL`);

        const result = await runEntitlementAllocation();
        expect(result.processed).toBe(1);

        const [expectedRiceG, expectedWheatG] = PER_CARD[category];
        const { rows } = await pool.query(
            `SELECT w.rice_balance_kg, w.wheat_balance_kg FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id WHERE rc.card_number = $1`,
            [`${category}-FS${familySize}`],
        );

        expect(Number(rows[0].rice_balance_kg)).toBe(gramsToKg(expectedRiceG));
        expect(Number(rows[0].wheat_balance_kg)).toBe(gramsToKg(expectedWheatG));

        // the invariant, restated against what actually landed in the wallet
        expect(kgToGrams(rows[0].rice_balance_kg)).toBeLessThanOrEqual(MAX_DISPENSE_TRANSACTION_GRAMS);
        expect(kgToGrams(rows[0].wheat_balance_kg)).toBeLessThanOrEqual(MAX_DISPENSE_TRANSACTION_GRAMS);
    });

    test('no wallet anywhere can hold more than one transaction can complete', async () => {
        for (const category of ['APL', 'BPL', 'AAY']) {
            await seedCard(`BULK-${category}`, category, 7);
        }
        await pool.query(`UPDATE wallets SET last_reset_date = NULL`);
        await runEntitlementAllocation();

        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS over FROM wallets
       WHERE rice_balance_kg * 1000 > $1 OR wheat_balance_kg * 1000 > $1`,
            [MAX_DISPENSE_TRANSACTION_GRAMS],
        );
        expect(rows[0].over).toBe(0);
    });
});

describe('admin card creation funds the wallet from the same source', () => {
    test('a newly created ration card gets the per-card allocation, not family_size x policy', async () => {
        const res = await request(app)
            .post('/api/admin/ration-cards')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                card_number: `ALLOC-NEW-${Date.now()}`,
                category: 'BPL',
                shop_id: shopId,
                head: { name: 'Alloc Head', mobile: `9${Math.floor(100000000 + Math.random() * 899999999)}`, age: 40 },
                members: [
                    { name: 'M1', age: 12 },
                    { name: 'M2', age: 9 },
                    { name: 'M3', age: 7 },
                ],
            });

        expect(res.status).toBe(201);
        // 4-member household still gets BPL's 3000 g / 2000 g — under the old
        // rule this was 5 kg x 4 = 20 kg of rice.
        expect(res.body.wallet.rice_balance_kg).toBe(3);
        expect(res.body.wallet.wheat_balance_kg).toBe(2);
    });
});

describe('IoT session boundary', () => {
    const openSession = async (rationCardId, commodity, entitledGrams) => {
        const qrSessionId = crypto.randomBytes(16).toString('hex');
        await pool.query(
            `INSERT INTO qr_sessions (session_id, ration_card_id, shop_id, expires_at) VALUES ($1, $2, $3, $4)`,
            [qrSessionId, rationCardId, shopId, new Date(Date.now() + 60000)],
        );
        return request(app)
            .post('/api/dispense/session')
            .set('Authorization', `Bearer ${shopkeeperToken}`)
            .send({ ration_card_id: rationCardId, commodity, entitled_grams: entitledGrams, qr_session_id: qrSessionId });
    };

    test('the whole allocation can be requested in ONE session', async () => {
        await pool.query(`TRUNCATE TABLE transactions, wallets, family_members, ration_cards RESTART IDENTITY CASCADE`);
        const rationCardId = await seedCard('IOT-WHOLE', 'AAY', 5);
        await pool.query(`UPDATE wallets SET last_reset_date = NULL`);
        await runEntitlementAllocation();

        // AAY rice = 4000 g = the entire wallet balance, in one session
        const res = await openSession(rationCardId, 'rice', 4000);
        expect(res.status).toBe(201);
    });

    test('a request above the transaction ceiling is rejected by the schema', async () => {
        await pool.query(`TRUNCATE TABLE transactions, wallets, family_members, ration_cards RESTART IDENTITY CASCADE`);
        const rationCardId = await seedCard('IOT-OVER', 'AAY', 2);
        await pool.query(`UPDATE wallets SET rice_balance_kg = 50 WHERE ration_card_id = $1`, [rationCardId]);

        const res = await openSession(rationCardId, 'rice', 5000);
        expect(res.status).toBe(400);
        expect(res.body.details.join(' ')).toMatch(/entitled_grams/);
    });

    test('the service itself rejects an over-ceiling allocation for non-HTTP callers', async () => {
        const result = await dispenseSessionService.createSession({
            shopId,
            rationCardId: crypto.randomUUID(),
            commodity: 'rice',
            entitledGrams: MAX_DISPENSE_TRANSACTION_GRAMS + 1000,
            qrSessionId: 'irrelevant',
        });
        expect(result.ok).toBe(false);
        expect(result.code).toBe('IOT_ALLOCATION_EXCEEDED');
    });

    test('the hardware sanity ceiling is a separate, higher limit', () => {
        const { MAX_VALID_GRAMS } = require('../src/config/iot');
        expect(MAX_VALID_GRAMS).toBeGreaterThan(MAX_DISPENSE_TRANSACTION_GRAMS);
    });
});

describe('allocationForPolicy', () => {
    test('derives both commodities and both units from one policy row', () => {
        expect(allocationForPolicy({ category: 'BPL', rice_per_card_grams: 3000, wheat_per_card_grams: 2000 })).toEqual({
            riceGrams: 3000,
            wheatGrams: 2000,
            riceKg: 3,
            wheatKg: 2,
        });
    });

    test('refuses a policy row that would break the invariant', () => {
        expect(() =>
            allocationForPolicy({ category: 'BPL', rice_per_card_grams: 20000, wheat_per_card_grams: 2000 }),
        ).toThrow(AllocationError);
    });
});
