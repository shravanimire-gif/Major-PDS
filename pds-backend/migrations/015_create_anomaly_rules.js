/* eslint-disable camelcase */
// Phase 3 — config for the IoT-specific streaming anomaly rules
// (services/anomalyRulesService.js). Deliberately separate from the
// existing anomaly_events/anomalyDetectionCron.js system (migration 005),
// which only ever looks at transactions/shops and has no IoT awareness —
// see PHASE3_DONE.md. Adding a new rule = one row here + one function in
// the registry, no dispatch code changes.
exports.up = (pgm) => {
    pgm.createTable('anomaly_rules', {
        rule_key: { type: 'varchar(50)', primaryKey: true },
        enabled: { type: 'boolean', notNull: true, default: true },
        severity: { type: 'varchar(20)', notNull: true }, // 'info' | 'warn' | 'critical'
        params_json: { type: 'jsonb', notNull: true, default: '{}' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    }, { ifNotExists: true });

    pgm.sql(`
    INSERT INTO anomaly_rules (rule_key, severity, params_json) VALUES
      ('NEAR_TOLERANCE', 'warn', '{"edge_margin_grams": 10, "window_days": 7, "min_occurrences": 3}'),
      ('OFF_HOURS', 'warn', '{"start_hour": 7, "end_hour": 21, "timezone": "Asia/Kolkata"}'),
      ('RAPID_FIRE', 'critical', '{"max_commits_per_minute": 6}'),
      ('DEVICE_ANOMALY', 'critical', '{"reject_pct_threshold": 5, "window_hours": 24}')
    ON CONFLICT (rule_key) DO NOTHING;
  `);
};

exports.down = (pgm) => {
    pgm.dropTable('anomaly_rules', { ifExists: true });
};
