/* eslint-disable camelcase */
// Phase 2 — per-commodity tolerance config, tunable without a code change
// (mirrors src/config/blockchainHealth.js's "centralized, named thresholds"
// pattern, as a DB table rather than a JS file since ops may want to tune
// this without a deploy). tolerance_grams = GREATEST(min_tolerance_grams,
// ROUND(entitled_grams * tolerance_pct / 100)) — see
// dispenseSessionService.js.
exports.up = (pgm) => {
    pgm.createTable('commodity_tolerances', {
        commodity: { type: 'varchar(20)', primaryKey: true },
        min_tolerance_grams: { type: 'integer', notNull: true, default: 20 },
        tolerance_pct: { type: 'numeric(5,2)', notNull: true, default: 1.00 },
    }, { ifNotExists: true });

    pgm.sql(`
    INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct) VALUES
      ('rice', 20, 1.00),
      ('wheat', 20, 1.00),
      ('sugar', 20, 1.00)
    ON CONFLICT (commodity) DO NOTHING;
  `);
};

exports.down = (pgm) => {
    pgm.dropTable('commodity_tolerances', { ifExists: true });
};
