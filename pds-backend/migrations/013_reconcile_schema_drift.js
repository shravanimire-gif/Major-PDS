/* eslint-disable camelcase */
// Reconciles schema drift discovered while building the Phase 2 E2E test: a
// migrations-only fresh database (`npm run migrate:up` on an empty DB, which
// is exactly what render.yaml's build step does for a real deploy) is
// missing several columns that the long-running dev database has acquired
// over time via undocumented ad-hoc ALTERs, and live code depends on. Found
// by diffing information_schema between the two — see PHASE2_DONE.md.
//
// Written defensively (IF NOT EXISTS / conditional rename) so it's safe to
// run both on a fresh DB (has the gaps) and on the existing dev DB (already
// has some of these, via the ad-hoc route) without erroring either way.
//
// - shops.is_active: read by shopkeeperController.js's getAssignedShop
//   (`COALESCE(s.is_active, true) = true`) on every shopkeeper request,
//   including the new dispenseSessionController.js — a fresh deploy would
//   500 on literally every shopkeeper/dispense-session endpoint without it.
// - shops.address / shops.contact_number, ration_cards.address,
//   users.address / users.age / users.gender: not currently read by any
//   query (grepped), but present on the real dev DB — added here so the two
//   schemas match going forward.
// - transactions.dispensed_by -> served_by: migration 001 created
//   `dispensed_by`, but no application code has ever referenced that name
//   (shopkeeperController.js's INSERT/SELECT statements all use
//   `served_by`) — the real dev DB only ever had `served_by`.
// Note: pgm.addColumns' `ifNotExists` option does not actually emit
// `IF NOT EXISTS` in this node-pg-migrate version (verified: the generated
// SQL has no such clause, and it fails with a duplicate-column error on a DB
// that already has the column) — using raw SQL instead, which does.
exports.up = (pgm) => {
    pgm.sql(`
    ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS contact_number varchar(50);
  `);
    pgm.sql(`
    ALTER TABLE ration_cards
      ADD COLUMN IF NOT EXISTS address text;
  `);
    pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS age integer,
      ADD COLUMN IF NOT EXISTS gender varchar(20);
  `);

    pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='dispensed_by')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='served_by')
      THEN
        ALTER TABLE transactions RENAME COLUMN dispensed_by TO served_by;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
    pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS age, DROP COLUMN IF EXISTS gender;`);
    pgm.sql(`ALTER TABLE ration_cards DROP COLUMN IF EXISTS address;`);
    pgm.sql(
        `ALTER TABLE shops DROP COLUMN IF EXISTS is_active, DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS contact_number;`,
    );
};
