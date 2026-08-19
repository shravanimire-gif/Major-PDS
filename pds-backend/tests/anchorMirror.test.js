// Blockchain anchoring still runs off dispense_records — that table owns the
// hash chain and the anchor lifecycle (anchorStatusService, anchorRetryCron).
// This asserts the one addition: the resulting hash is mirrored onto the
// linked canonical transaction, so the shared business surfaces stay truthful.
// Without the mirror, blockchainHealthService (which counts
// transactions.blockchain_tx_hash IS NULL as a pending anchor) would report
// every IoT dispense as permanently unanchored.
//
// blockchainService is mocked: this is about the DB write-back, and the real
// one submits to Sepolia.
jest.mock('../src/services/blockchainService', () => ({
    recordDispense: jest.fn(),
}));

require('./setup');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Pool } = require('pg');
const { recordDispense } = require('../src/services/blockchainService');
const { enqueueAnchor } = require('../src/services/anchorEnqueuer');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });

let shopId, areaId, shopkeeperId;

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 150));

// Builds a committed IoT dispense directly (no WS/session machinery — this
// suite is only about what happens after commit).
//
// Each call gets its OWN ration card: one claim per card per commodity per
// month is now a database guarantee (migration 025), so reusing a single card
// across these fixtures would collide on the monthly-claim index.
const seedCommittedDispense = async (suffix) => {
    const cardRes = await pool.query(
        `INSERT INTO ration_cards (card_number, category, shop_id, area_id)
     VALUES ($1, 'BPL', $2, $3) RETURNING id`,
        [`BPL-ANCHOR-${suffix}`.slice(0, 50), shopId, areaId],
    );
    const rationCardId = cardRes.rows[0].id;
    await pool.query(`INSERT INTO wallets (ration_card_id, rice_balance_kg) VALUES ($1, 50)`, [rationCardId]);

    const txRes = await pool.query(
        `INSERT INTO transactions (ration_card_id, shop_id, served_by, rice_qty_kg, wheat_qty_kg)
     VALUES ($1, $2, $3, 4, 0) RETURNING id`,
        [rationCardId, shopId, shopkeeperId],
    );
    const sessionRes = await pool.query(
        `INSERT INTO dispense_sessions (shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, state, expires_at, committed_at)
     VALUES ($1, $2, 'rice', 4000, 40, 'committed', NOW() + INTERVAL '1 minute', NOW()) RETURNING id`,
        [shopId, rationCardId],
    );
    const drRes = await pool.query(
        `INSERT INTO dispense_records
       (session_id, ration_card_id, shop_id, commodity, entitled_grams, measured_grams, row_hash, transaction_id)
     VALUES ($1, $2, $3, 'rice', 4000, 4000, $4, $5) RETURNING id`,
        [sessionRes.rows[0].id, rationCardId, shopId, `row-hash-${suffix}`, txRes.rows[0].id],
    );
    return { transactionId: txRes.rows[0].id, dispenseRecordId: drRes.rows[0].id };
};

beforeAll(async () => {
    const areaRes = await pool.query(
        `INSERT INTO areas (name) VALUES ('AnchorMirrorArea') ON CONFLICT (name) DO UPDATE SET name='AnchorMirrorArea' RETURNING id`,
    );
    areaId = areaRes.rows[0].id;

    const skRes = await pool.query(
        `INSERT INTO users (role, email, password_hash) VALUES ('shopkeeper', 'anchor-mirror-sk@test.com', $1) RETURNING id`,
        [await bcrypt.hash('pw', 10)],
    );
    shopkeeperId = skRes.rows[0].id;

    const shopRes = await pool.query(
        `INSERT INTO shops (shop_code, shop_name, area_id, shopkeeper_id) VALUES ('ANCH-001', 'Anchor Mirror Shop', $1, $2) RETURNING id`,
        [areaId, shopkeeperId],
    );
    shopId = shopRes.rows[0].id;

});

afterAll(async () => {
    await pool.end();
});

beforeEach(() => recordDispense.mockReset());

describe('anchor hash mirroring', () => {
    it('writes the hash to dispense_records AND the linked transaction', async () => {
        const { transactionId, dispenseRecordId } = await seedCommittedDispense(crypto.randomUUID());
        const txHash = '0xmirroredhash0001';
        recordDispense.mockResolvedValue({ success: true, txHash });

        await enqueueAnchor(dispenseRecordId);
        await flushAsync();

        const dr = await pool.query(`SELECT blockchain_tx_hash FROM dispense_records WHERE id = $1`, [
            dispenseRecordId,
        ]);
        const tx = await pool.query(`SELECT blockchain_tx_hash FROM transactions WHERE id = $1`, [transactionId]);

        expect(dr.rows[0].blockchain_tx_hash).toBe(txHash);
        expect(tx.rows[0].blockchain_tx_hash).toBe(txHash);
    });

    it('leaves both NULL when anchoring fails, and records the error on the ledger row only', async () => {
        const { transactionId, dispenseRecordId } = await seedCommittedDispense(crypto.randomUUID());
        recordDispense.mockResolvedValue({ success: false, error: 'RPC timeout' });

        await enqueueAnchor(dispenseRecordId);
        await flushAsync();

        const dr = await pool.query(
            `SELECT blockchain_tx_hash, last_anchor_error FROM dispense_records WHERE id = $1`,
            [dispenseRecordId],
        );
        const tx = await pool.query(`SELECT blockchain_tx_hash FROM transactions WHERE id = $1`, [transactionId]);

        expect(dr.rows[0].blockchain_tx_hash).toBeNull();
        expect(dr.rows[0].last_anchor_error).toBe('RPC timeout');
        expect(tx.rows[0].blockchain_tx_hash).toBeNull(); // stays "pending", correctly
    });

    it('still anchors a legacy dispense_record that has no linked transaction', async () => {
        // Rows committed before the link existed keep transaction_id = NULL.
        const { dispenseRecordId } = await seedCommittedDispense(crypto.randomUUID());
        await pool.query(`UPDATE dispense_records SET transaction_id = NULL WHERE id = $1`, [dispenseRecordId]);
        recordDispense.mockResolvedValue({ success: true, txHash: '0xlegacyhash0002' });

        await enqueueAnchor(dispenseRecordId);
        await flushAsync();

        const dr = await pool.query(`SELECT blockchain_tx_hash FROM dispense_records WHERE id = $1`, [
            dispenseRecordId,
        ]);
        expect(dr.rows[0].blockchain_tx_hash).toBe('0xlegacyhash0002');
    });

    it('anchors from dispense_records — the ledger row, not the transaction, is the source', async () => {
        const { dispenseRecordId } = await seedCommittedDispense(crypto.randomUUID());
        recordDispense.mockResolvedValue({ success: true, txHash: '0xsourcecheck0003' });

        await enqueueAnchor(dispenseRecordId);
        await flushAsync();

        expect(recordDispense).toHaveBeenCalledTimes(1);
        const arg = recordDispense.mock.calls[0][0];
        // measured_grams -> kg, straight off the dispense_record
        expect(arg.riceQtyKg).toBe(4);
        expect(arg.wheatQtyKg).toBe(0);
        expect(arg.transactionId).toBe(dispenseRecordId);
    });
});

// ---------------------------------------------------------------------------
// Regression: the anchor hash and its mirror must be written ATOMICALLY.
//
// They used to be two independent UPDATEs chained with .then(), which left a
// window — and on failure a PERMANENT state — where dispense_records carried the
// hash but transactions did not. Nothing reconciles that: anchorRetryCron only
// re-attempts records whose OWN hash is NULL, while blockchainHealthService
// counts transactions.blockchain_tx_hash IS NULL as pending. The dispense would
// read as unanchored forever.
// ---------------------------------------------------------------------------
describe('storeAnchorHash — atomic mirror write', () => {
    const { storeAnchorHash } = require('../src/services/anchorEnqueuer');

    it('writes the hash to BOTH dispense_records and transactions', async () => {
        const seeded = await seedCommittedDispense('ATOMIC001');
        const hash = '0x' + 'a1'.repeat(32);

        await storeAnchorHash(seeded.dispenseRecordId, seeded.transactionId, hash);

        const record = await pool.query(
            'SELECT blockchain_tx_hash, last_anchor_error FROM dispense_records WHERE id = $1',
            [seeded.dispenseRecordId],
        );
        const tx = await pool.query('SELECT blockchain_tx_hash FROM transactions WHERE id = $1', [
            seeded.transactionId,
        ]);

        expect(record.rows[0].blockchain_tx_hash).toBe(hash);
        expect(record.rows[0].last_anchor_error).toBeNull();
        expect(tx.rows[0].blockchain_tx_hash).toBe(hash);
    });

    it('leaves the record hash NULL when the mirror write fails, so the retry cron re-attempts', async () => {
        const seeded = await seedCommittedDispense('ATOMIC002');
        const hash = '0x' + 'b2'.repeat(32);

        // The failure is forced on the SECOND statement specifically: a
        // malformed transaction id makes the mirror UPDATE raise a uuid type
        // error after the record UPDATE has already applied. That is exactly the
        // shape of the bug being guarded against — first write succeeded, second
        // did not — and the whole unit must roll back.
        await expect(
            storeAnchorHash(seeded.dispenseRecordId, 'not-a-valid-uuid', hash),
        ).rejects.toThrow();

        const record = await pool.query('SELECT blockchain_tx_hash FROM dispense_records WHERE id = $1', [
            seeded.dispenseRecordId,
        ]);
        const tx = await pool.query('SELECT blockchain_tx_hash FROM transactions WHERE id = $1', [
            seeded.transactionId,
        ]);

        // Neither row moved — the record stays NULL, which is exactly what makes
        // it eligible for anchorRetryCron's next pass.
        expect(record.rows[0].blockchain_tx_hash).toBeNull();
        expect(tx.rows[0].blockchain_tx_hash).toBeNull();

        // And a subsequent good write still succeeds on both rows.
        await storeAnchorHash(seeded.dispenseRecordId, seeded.transactionId, hash);
        const after = await pool.query(
            `SELECT dr.blockchain_tx_hash AS record_hash, t.blockchain_tx_hash AS tx_hash
         FROM dispense_records dr JOIN transactions t ON t.id = dr.transaction_id
        WHERE dr.id = $1`,
            [seeded.dispenseRecordId],
        );
        expect(after.rows[0].record_hash).toBe(hash);
        expect(after.rows[0].tx_hash).toBe(hash);
    });

    it('is a no-op on transactions when the record has no linked transaction', async () => {
        const seeded = await seedCommittedDispense('ATOMIC003');
        await pool.query('UPDATE dispense_records SET transaction_id = NULL WHERE id = $1', [
            seeded.dispenseRecordId,
        ]);
        const hash = '0x' + 'd4'.repeat(32);

        await storeAnchorHash(seeded.dispenseRecordId, null, hash);

        const record = await pool.query('SELECT blockchain_tx_hash FROM dispense_records WHERE id = $1', [
            seeded.dispenseRecordId,
        ]);
        expect(record.rows[0].blockchain_tx_hash).toBe(hash);
    });
});
