/* eslint-disable camelcase */
// Makes commodity_tolerances a guaranteed, validated baseline rather than
// something that happened to be seeded if migration 011 ran.
//
// THE PROBLEM
// -----------
// schema.sql CREATEs commodity_tolerances but never seeds it; migration 011
// seeds rice/wheat. A database bootstrapped from schema.sql alone therefore
// had an EMPTY tolerance table, and dispenseSessionService.computeToleranceGrams
// silently fell back to a hardcoded { min_tolerance_grams: 20, tolerance_pct: 1 }.
// Two environments could apply different physical dispensing tolerances with
// nothing in the logs to say so. For a rule that decides whether a measured
// weight is accepted, an undocumented implicit default is not acceptable.
//
// WHAT THIS MIGRATION DOES
// ------------------------
// 1. Re-asserts the rice/wheat rows idempotently (values UNCHANGED from
//    migration 011 — 20 g floor, 1.00% — they are the values the live system
//    already uses and are not being redesigned here).
// 2. Adds the integrity constraints the table never had: a positive floor, a
//    sane percentage band, and commodity restricted to the two supported
//    commodities. The PRIMARY KEY on `commodity` already prevents duplicate
//    configuration per commodity, so no extra uniqueness is added.
//
// The commodity CHECK is deliberately an allow-list of ('rice','wheat'). It
// doubles as a guard against sugar ever being reintroduced through this table
// (see migration 021), and it is the same two-commodity domain that
// allocationPolicyService enforces.
//
// Deliberately NOT done: no max-tolerance column and no is_active flag. The
// table is a two-row lookup keyed by commodity; adding lifecycle columns
// nothing reads would be schema for its own sake.

exports.up = (pgm) => {
    // Values identical to migrations/011_create_commodity_tolerances.js.
    pgm.sql(`
    INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct) VALUES
      ('rice', 20, 1.00),
      ('wheat', 20, 1.00)
    ON CONFLICT (commodity) DO NOTHING;
  `);

    // Remove anything outside the supported domain before constraining it, so
    // the migration cannot fail on a database that still carries a stale row.
    // Audited first: zero such rows exist on this database.
    pgm.sql(`DELETE FROM commodity_tolerances WHERE commodity NOT IN ('rice', 'wheat');`);

    pgm.sql(`
    ALTER TABLE commodity_tolerances
      ADD CONSTRAINT commodity_tolerances_commodity_check
      CHECK (commodity IN ('rice', 'wheat'));

    ALTER TABLE commodity_tolerances
      ADD CONSTRAINT commodity_tolerances_min_tolerance_grams_check
      CHECK (min_tolerance_grams > 0 AND min_tolerance_grams <= 500);

    ALTER TABLE commodity_tolerances
      ADD CONSTRAINT commodity_tolerances_tolerance_pct_check
      CHECK (tolerance_pct > 0 AND tolerance_pct <= 100);
  `);
};

exports.down = (pgm) => {
    pgm.sql(`
    ALTER TABLE commodity_tolerances DROP CONSTRAINT IF EXISTS commodity_tolerances_commodity_check;
    ALTER TABLE commodity_tolerances DROP CONSTRAINT IF EXISTS commodity_tolerances_min_tolerance_grams_check;
    ALTER TABLE commodity_tolerances DROP CONSTRAINT IF EXISTS commodity_tolerances_tolerance_pct_check;
  `);
    // Seed rows are intentionally left in place: they are required baseline
    // configuration, and deleting them on rollback would reintroduce exactly
    // the silent-fallback condition this migration exists to remove.
};
