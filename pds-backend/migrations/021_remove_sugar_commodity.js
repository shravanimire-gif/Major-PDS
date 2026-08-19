/* eslint-disable camelcase */
// Removes sugar as a supported commodity. The active domain becomes exactly
// { rice, wheat } — there is no sugar column, no sugar config row, and no
// hidden zero-valued sugar field left anywhere.
//
// Ordering matters: v_beneficiaries / v_transactions / v_blockchain_pending
// each SELECT a sugar column, and PostgreSQL refuses DROP COLUMN while a
// view depends on it. They're dropped first and recreated at the end, which
// is why no CASCADE is needed anywhere in this migration — nothing is
// dropped that we haven't explicitly accounted for.
//
// Audited before writing this (against the live dev DB):
//   policies              3 rows with sugar_per_person_kg  (config)
//   wallets              20 rows, 19 with sugar > 0, 82.00 kg total
//                        (not history — the entitlement cron rewrites these
//                        monthly, see entitlementService.js)
//   transactions          1 row with sugar_qty_kg = 2.00, alongside
//                        rice 12.00 + wheat 8.00 on the same row; zero
//                        sugar-ONLY rows, so no dispense record is emptied
//                        by this drop
//   commodity_tolerances  1 sugar row
//   dispense_sessions     0 rows
//   dispense_records      0 rows
//
// That single 2.00 kg transaction figure was never anchored on-chain —
// PDSLedger.recordTransaction has only riceQtyGrams/wheatQtyGrams, so no
// blockchain record contradicts its removal. Dropped outright, no archive,
// per an explicit decision to keep the schema free of sugar artifacts.
//
// down() restores the columns, constraints and views so the schema shape is
// reversible, but it CANNOT restore that 2.00 kg — restored columns come
// back at their DEFAULT 0. This migration is one-way for data.

exports.up = (pgm) => {
    // 1. Views depend on the columns below — drop before altering the tables.
    pgm.sql(`
    DROP VIEW IF EXISTS v_blockchain_pending;
    DROP VIEW IF EXISTS v_transactions;
    DROP VIEW IF EXISTS v_beneficiaries;
  `);

    // 2. Sugar config row (commodity_tolerances is keyed by commodity name).
    pgm.sql(`DELETE FROM commodity_tolerances WHERE commodity = 'sugar';`);

    // 3. Both tables are empty on the audited database, but a fresh deploy or
    //    another environment may not be — keep the migration correct there.
    //    dispense_records is deleted before dispense_sessions: the former has
    //    a FK to the latter with ON DELETE RESTRICT.
    pgm.sql(`
    DELETE FROM dispense_records  WHERE commodity = 'sugar';
    DELETE FROM dispense_sessions WHERE commodity = 'sugar';
  `);

    // 4. Drop the columns. Their CHECK (>= 0) and NOT NULL constraints are
    //    attached to the columns and go with them — no separate DROP
    //    CONSTRAINT needed, and nothing else references them.
    pgm.sql(`
    ALTER TABLE policies     DROP COLUMN IF EXISTS sugar_per_person_kg;
    ALTER TABLE wallets      DROP COLUMN IF EXISTS sugar_balance_kg;
    ALTER TABLE transactions DROP COLUMN IF EXISTS sugar_qty_kg;
  `);

    // 5. Recreate the views, rice/wheat only. Bodies are otherwise identical
    //    to schema.sql section 6 — only the sugar column is gone.
    pgm.sql(`
    CREATE VIEW v_beneficiaries AS
    SELECT
        rc.id              AS ration_card_id,
        rc.card_number,
        rc.category,
        rc.is_active,
        fm.name            AS head_name,
        u.mobile,
        s.shop_code,
        s.shop_name,
        a.name             AS area_name,
        w.rice_balance_kg,
        w.wheat_balance_kg,
        (
            SELECT COUNT(*) FROM family_members fm2
            WHERE fm2.ration_card_id = rc.id
        )::INT             AS family_size,
        rc.created_at
    FROM ration_cards rc
    JOIN family_members fm ON fm.ration_card_id = rc.id AND fm.is_head = TRUE
    JOIN users u           ON u.id  = fm.user_id
    JOIN shops s           ON s.id  = rc.shop_id
    JOIN areas a           ON a.id  = rc.area_id
    LEFT JOIN wallets w    ON w.ration_card_id = rc.id;

    CREATE VIEW v_transactions AS
    SELECT
        t.id,
        t.created_at,
        rc.card_number,
        rc.category,
        s.shop_name,
        u.name                    AS served_by_name,
        t.rice_qty_kg,
        t.wheat_qty_kg,
        t.blockchain_tx_hash,
        bl.status                 AS blockchain_status,
        bl.confirmed_at           AS blockchain_confirmed_at
    FROM transactions t
    JOIN ration_cards rc       ON rc.id = t.ration_card_id
    JOIN shops s               ON s.id  = t.shop_id
    LEFT JOIN users u          ON u.id  = t.served_by
    LEFT JOIN blockchain_logs bl ON bl.transaction_id = t.id;

    CREATE VIEW v_blockchain_pending AS
    SELECT
        bl.id,
        bl.transaction_id,
        bl.tx_hash,
        bl.attempts,
        bl.last_error,
        bl.submitted_at,
        t.ration_card_id,
        t.shop_id,
        t.rice_qty_kg,
        t.wheat_qty_kg,
        t.created_at       AS transaction_date
    FROM blockchain_logs bl
    JOIN transactions t ON t.id = bl.transaction_id
    WHERE bl.status = 'pending'
    ORDER BY bl.submitted_at;
  `);
};

exports.down = (pgm) => {
    // Restores schema shape only. Sugar VALUES are not recoverable — every
    // restored column comes back at DEFAULT 0.
    pgm.sql(`
    DROP VIEW IF EXISTS v_blockchain_pending;
    DROP VIEW IF EXISTS v_transactions;
    DROP VIEW IF EXISTS v_beneficiaries;
  `);

    pgm.sql(`
    ALTER TABLE policies     ADD COLUMN IF NOT EXISTS sugar_per_person_kg NUMERIC(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE wallets      ADD COLUMN IF NOT EXISTS sugar_balance_kg    NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (sugar_balance_kg >= 0);
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sugar_qty_kg        NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (sugar_qty_kg >= 0);
  `);

    pgm.sql(`
    INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct)
    VALUES ('sugar', 20, 1.00)
    ON CONFLICT (commodity) DO NOTHING;
  `);

    pgm.sql(`
    CREATE VIEW v_beneficiaries AS
    SELECT
        rc.id              AS ration_card_id,
        rc.card_number,
        rc.category,
        rc.is_active,
        fm.name            AS head_name,
        u.mobile,
        s.shop_code,
        s.shop_name,
        a.name             AS area_name,
        w.rice_balance_kg,
        w.wheat_balance_kg,
        w.sugar_balance_kg,
        (
            SELECT COUNT(*) FROM family_members fm2
            WHERE fm2.ration_card_id = rc.id
        )::INT             AS family_size,
        rc.created_at
    FROM ration_cards rc
    JOIN family_members fm ON fm.ration_card_id = rc.id AND fm.is_head = TRUE
    JOIN users u           ON u.id  = fm.user_id
    JOIN shops s           ON s.id  = rc.shop_id
    JOIN areas a           ON a.id  = rc.area_id
    LEFT JOIN wallets w    ON w.ration_card_id = rc.id;

    CREATE VIEW v_transactions AS
    SELECT
        t.id,
        t.created_at,
        rc.card_number,
        rc.category,
        s.shop_name,
        u.name                    AS served_by_name,
        t.rice_qty_kg,
        t.wheat_qty_kg,
        t.sugar_qty_kg,
        t.blockchain_tx_hash,
        bl.status                 AS blockchain_status,
        bl.confirmed_at           AS blockchain_confirmed_at
    FROM transactions t
    JOIN ration_cards rc       ON rc.id = t.ration_card_id
    JOIN shops s               ON s.id  = t.shop_id
    LEFT JOIN users u          ON u.id  = t.served_by
    LEFT JOIN blockchain_logs bl ON bl.transaction_id = t.id;

    CREATE VIEW v_blockchain_pending AS
    SELECT
        bl.id,
        bl.transaction_id,
        bl.tx_hash,
        bl.attempts,
        bl.last_error,
        bl.submitted_at,
        t.ration_card_id,
        t.shop_id,
        t.rice_qty_kg,
        t.wheat_qty_kg,
        t.sugar_qty_kg,
        t.created_at       AS transaction_date
    FROM blockchain_logs bl
    JOIN transactions t ON t.id = bl.transaction_id
    WHERE bl.status = 'pending'
    ORDER BY bl.submitted_at;
  `);
};
