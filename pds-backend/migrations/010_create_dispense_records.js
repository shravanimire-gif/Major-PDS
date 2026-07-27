/* eslint-disable camelcase */
// Phase 2 — the committed ledger row for an IoT-verified dispense. Separate
// from the legacy `transactions` table (manual-entry dispenses) since this
// models exactly one commodity per record (one container on one scale at a
// time), not rice+wheat+sugar together. row_hash/prev_hash form a per-shop
// hash chain (see src/services/chainRowBuilder.js); blockchain_tx_hash
// follows the same NULL-means-retry-pending convention as `transactions`.
exports.up = (pgm) => {
    pgm.createTable('dispense_records', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        session_id: { type: 'uuid', notNull: true, references: 'dispense_sessions', onDelete: 'RESTRICT' },
        ration_card_id: { type: 'uuid', notNull: true, references: 'ration_cards', onDelete: 'RESTRICT' },
        shop_id: { type: 'uuid', notNull: true, references: 'shops', onDelete: 'RESTRICT' },
        commodity: { type: 'varchar(20)', notNull: true },
        entitled_grams: { type: 'integer', notNull: true },
        measured_grams: { type: 'integer', notNull: true },
        // NULL only for the very first record in a shop's chain.
        prev_hash: { type: 'text' },
        row_hash: { type: 'text', notNull: true },
        committed_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        blockchain_tx_hash: { type: 'text' },
    }, { ifNotExists: true });

    // The prev_hash lookup: "last committed row for this shop."
    pgm.createIndex('dispense_records', ['shop_id', 'committed_at'], { ifNotExists: true });
    pgm.createIndex('dispense_records', 'ration_card_id', { ifNotExists: true });
    pgm.createIndex('dispense_records', 'session_id', { ifNotExists: true, unique: true });
};

exports.down = (pgm) => {
    pgm.dropTable('dispense_records', { ifExists: true });
};
