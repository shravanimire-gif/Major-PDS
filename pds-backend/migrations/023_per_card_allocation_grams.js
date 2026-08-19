/* eslint-disable camelcase */
// Redenominates the entitlement policy from "kg per person" to "grams per
// ration card", so that a household's complete allocation for one commodity
// is inherently deliverable in a single IoT dispensing transaction.
//
// WHY THE OLD MODEL COULD NOT SATISFY THE CONSTRAINT
// --------------------------------------------------
// Allocation was rice_per_person_kg x family_size (plus a hardcoded flat
// 35 kg for AAY rice in entitlementService, which ignored the policy column
// entirely). Family size is unbounded, so the product is unbounded: on this
// database it produced up to 45 kg of rice and 48 kg of wheat in a single
// wallet. Nothing but a clamp could have held that under 4 kg, and a clamp
// would mean the system authorises grain it cannot dispense in one pass.
//
// Denominating the policy per card makes the ceiling structural instead:
// the CHECK constraints below mean the policy table physically cannot hold
// a value a single transaction could not complete, so no arithmetic in any
// service can produce an over-large allocation. Category differentiation is
// preserved — each category keeps its own per-commodity figure.
//
// 4000 is MAX_DISPENSE_TRANSACTION_GRAMS in src/config/allocation.js; SQL
// cannot read that constant, so the two must be changed together. The
// multiple-of-10 rule mirrors ALLOCATION_GRAMS_STEP and keeps the
// grams <-> NUMERIC(8,2) kg round trip lossless.
//
// DATA IMPACT — NOT SILENT, see the final report
// ----------------------------------------------
// All 20 existing wallet rows are re-allocated to the new per-card figures.
// 19 of them currently hold more than 4 kg and would otherwise remain
// undispensable under the new model. This is the same operation the monthly
// entitlement cron performs (it overwrites balances wholesale every period),
// so no history is lost: `transactions` and `dispense_records` are the
// dispensing audit trail and are NOT touched by this migration.

const NEW_POLICY = [
    // category, rice grams/card, wheat grams/card
    ["APL", 2000, 1500],
    ["BPL", 3000, 2000],
    ["AAY", 4000, 3000],
];

exports.up = (pgm) => {
    // 1. New columns, nullable while we backfill.
    pgm.sql(`
    ALTER TABLE policies ADD COLUMN IF NOT EXISTS rice_per_card_grams  INTEGER;
    ALTER TABLE policies ADD COLUMN IF NOT EXISTS wheat_per_card_grams INTEGER;
  `);

    // 2. Backfill. Values are set explicitly per category rather than derived
    //    from the old per-person figures: the old numbers are a different
    //    unit AND a different denominator, so any arithmetic conversion would
    //    be a fiction. The ordering APL < BPL < AAY of the previous policy is
    //    preserved.
    for (const [category, riceGrams, wheatGrams] of NEW_POLICY) {
        pgm.sql(`
      UPDATE policies
         SET rice_per_card_grams  = ${riceGrams},
             wheat_per_card_grams = ${wheatGrams}
       WHERE category = '${category}';
    `);
    }

    // Any category not in NEW_POLICY (none today, but the column is about to
    // become NOT NULL) gets the most conservative allocation rather than
    // failing the migration.
    pgm.sql(`
    UPDATE policies
       SET rice_per_card_grams  = COALESCE(rice_per_card_grams, 2000),
           wheat_per_card_grams = COALESCE(wheat_per_card_grams, 1500);
  `);

    // 3. Lock the invariant into the schema.
    pgm.sql(`
    ALTER TABLE policies ALTER COLUMN rice_per_card_grams  SET NOT NULL;
    ALTER TABLE policies ALTER COLUMN wheat_per_card_grams SET NOT NULL;

    ALTER TABLE policies ADD CONSTRAINT policies_rice_per_card_grams_check
      CHECK (rice_per_card_grams  > 0 AND rice_per_card_grams  <= 4000 AND rice_per_card_grams  % 10 = 0);
    ALTER TABLE policies ADD CONSTRAINT policies_wheat_per_card_grams_check
      CHECK (wheat_per_card_grams > 0 AND wheat_per_card_grams <= 4000 AND wheat_per_card_grams % 10 = 0);
  `);

    // 4. Retire the per-person columns. Keeping them would leave two
    //    contradictory sources of truth for "how much is this household
    //    entitled to", which is how the AAY flat-35 drift happened.
    pgm.sql(`
    ALTER TABLE policies DROP COLUMN IF EXISTS rice_per_person_kg;
    ALTER TABLE policies DROP COLUMN IF EXISTS wheat_per_person_kg;
  `);

    // 5. Re-allocate every wallet to the new model. last_reset_date is
    //    stamped to today because this IS an allocation run — it keeps the
    //    entitlement cron's "already ran today" guard honest.
    pgm.sql(`
    UPDATE wallets w
       SET rice_balance_kg  = p.rice_per_card_grams  / 1000.0,
           wheat_balance_kg = p.wheat_per_card_grams / 1000.0,
           last_reset_date  = CURRENT_DATE,
           updated_at       = NOW()
      FROM ration_cards rc
      JOIN policies p ON p.category = rc.category
     WHERE w.ration_card_id = rc.id;
  `);
};

exports.down = (pgm) => {
    // Restores the per-person columns and their previous seeded values.
    // Wallet balances are NOT restored: the pre-migration numbers were
    // derived from family size at allocation time and are not recoverable
    // from the policy table alone. Re-running the entitlement cron after a
    // rollback repopulates them under the old rules.
    pgm.sql(`
    ALTER TABLE policies ADD COLUMN IF NOT EXISTS rice_per_person_kg  NUMERIC(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE policies ADD COLUMN IF NOT EXISTS wheat_per_person_kg NUMERIC(5,2) NOT NULL DEFAULT 0;
  `);

    pgm.sql(`
    UPDATE policies SET rice_per_person_kg = 3.00, wheat_per_person_kg = 2.00 WHERE category = 'APL';
    UPDATE policies SET rice_per_person_kg = 5.00, wheat_per_person_kg = 3.00 WHERE category = 'BPL';
    UPDATE policies SET rice_per_person_kg = 7.00, wheat_per_person_kg = 8.00 WHERE category = 'AAY';
  `);

    pgm.sql(`
    ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_rice_per_card_grams_check;
    ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_wheat_per_card_grams_check;
    ALTER TABLE policies DROP COLUMN IF EXISTS rice_per_card_grams;
    ALTER TABLE policies DROP COLUMN IF EXISTS wheat_per_card_grams;
  `);
};
