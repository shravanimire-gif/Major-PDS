/* eslint-disable camelcase */
// Makes an IoT dispense visible to the business pipeline.
//
// Before this migration there were two disconnected persistence paths:
//   manual dispense -> transactions      (read by analytics, anomaly
//                                         detection, activity feed, the
//                                         shopkeeper "today" count and the
//                                         admin integrity checks)
//   IoT dispense    -> dispense_records  (read only by the IoT audit
//                                         surfaces: anomalyRulesService's
//                                         device rules, anchorStatusService,
//                                         anchorRetryCron, session forensics)
//
// so a committed IoT dispense debited the wallet and anchored on-chain while
// every business dashboard behaved as though nothing had happened.
//
// The fix is a relationship, not a second transaction system:
// dispenseSessionService.commitSession now writes the canonical `transactions`
// row inside the SAME PostgreSQL transaction that debits the wallet and
// writes the ledger row, and points the ledger row at it. dispense_records
// keeps its distinct purpose — per-commodity measured grams, the per-shop
// prev_hash/row_hash chain, and the on-chain anchor state — as the IoT audit
// satellite of the canonical business transaction.
//
// Cardinality is 1:1-optional:
//   - a manual transaction has no dispense_record
//   - an IoT dispense_record has exactly one transaction
//   - pre-existing IoT rows keep transaction_id = NULL (see backfill note)
// hence a nullable column plus a PARTIAL unique index rather than NOT NULL.
//
// Deliberately NOT backfilled: a historical dispense_record predates this
// change and has already debited its wallet. Synthesising `transactions` rows
// for those would retroactively alter analytics totals and could trip the
// shopkeeper monthly double-claim check for cards that legitimately dispensed
// again since. Existing IoT audit history is preserved untouched; only
// dispenses committed from now on flow into the business pipeline.
// (Audited before writing: dispense_records currently holds 0 rows on this
// database, so there is nothing to backfill in practice either.)

exports.up = (pgm) => {
    pgm.sql(`ALTER TABLE dispense_records ADD COLUMN IF NOT EXISTS transaction_id UUID;`);

    // ON DELETE RESTRICT matches every other FK on this table — an IoT audit
    // row must never be silently orphaned from its business transaction.
    pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dispense_records_transaction_id_fkey'
      ) THEN
        ALTER TABLE dispense_records
          ADD CONSTRAINT dispense_records_transaction_id_fkey
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;
      END IF;
    END $$;
  `);

    // Enforces "one business transaction per IoT dispense" at the database
    // level. Partial so the many legacy NULLs don't collide with each other.
    pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS dispense_records_transaction_id_unique_index
      ON dispense_records (transaction_id)
      WHERE transaction_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
    // Drops only the link. The `transactions` rows created by committed IoT
    // dispenses are left in place: they are real business events with real
    // wallet debits behind them, and deleting them here would corrupt
    // analytics and reopen the monthly double-claim window.
    pgm.sql(`DROP INDEX IF EXISTS dispense_records_transaction_id_unique_index;`);
    pgm.sql(`
    ALTER TABLE dispense_records DROP CONSTRAINT IF EXISTS dispense_records_transaction_id_fkey;
  `);
    pgm.sql(`ALTER TABLE dispense_records DROP COLUMN IF EXISTS transaction_id;`);
};
