/* eslint-disable camelcase */
// Makes "one claim per ration card per commodity per calendar month" a
// database guarantee instead of an application convention.
//
// THE RACE THIS CLOSES
// --------------------
// shopkeeperController checked eligibility with `pool.query(SELECT COUNT(*))`
// on a DIFFERENT connection, BEFORE `client.query("BEGIN")`. Two concurrent
// requests for the same card therefore both read 0 and both inserted — a
// textbook time-of-check/time-of-use race. No amount of application logic
// fixes that; only the database can serialise it.
//
// WHY PARTIAL INDEXES, PER COMMODITY
// ----------------------------------
// A single unique index on (ration_card_id, month) would be wrong. An IoT
// dispense_session covers exactly ONE commodity, so a beneficiary collecting
// both rice and wheat legitimately produces two transaction rows; a combined
// index would reject the second commodity. Two partial indexes express the
// real rule:
//
//   rice  index: at most one row per (card, month) WHERE rice_qty_kg  > 0
//   wheat index: at most one row per (card, month) WHERE wheat_qty_kg > 0
//
//   manual rice+wheat  -> one row, satisfies both indexes            OK
//   IoT rice, IoT wheat -> two rows, one hits each index             OK
//   IoT rice, manual rice -> second row collides on the rice index   BLOCKED
//   concurrent rice x2  -> one commits, the other gets 23505         BLOCKED
//
// date_trunc('month', created_at) is used as the index expression:
// transactions.created_at is `timestamp without time zone`, for which
// date_trunc(text, timestamp) is IMMUTABLE (pg_proc.provolatile = 'i') and so
// is indexable. The timestamptz overload is only STABLE and would be rejected.
//
// Audited before writing: zero duplicate (ration_card_id, month, commodity)
// groups exist on this database, so both indexes build without conflict. No
// data is modified, dropped or rewritten by this migration.

exports.up = (pgm) => {
    pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS transactions_rice_monthly_claim_unique_index
      ON transactions (ration_card_id, date_trunc('month', created_at))
      WHERE rice_qty_kg > 0;
  `);

    pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS transactions_wheat_monthly_claim_unique_index
      ON transactions (ration_card_id, date_trunc('month', created_at))
      WHERE wheat_qty_kg > 0;
  `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP INDEX IF EXISTS transactions_rice_monthly_claim_unique_index;`);
    pgm.sql(`DROP INDEX IF EXISTS transactions_wheat_monthly_claim_unique_index;`);
};
