/* eslint-disable camelcase */
// Phase 3 — flags raised by services/anomalyRulesService.js. resolved_at is
// set by a manual admin action (POST /api/admin/anomalies/:id/resolve);
// auto_resolved_at is set by the rule engine itself the next time it runs
// and finds the condition no longer holds (e.g. RAPID_FIRE dropping back
// under threshold). Both are independent — a flag can be manually resolved
// even if the underlying condition is still technically true.
exports.up = (pgm) => {
    pgm.createTable('anomaly_flags', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        rule_key: { type: 'varchar(50)', notNull: true, references: 'anomaly_rules', onDelete: 'RESTRICT' },
        shop_id: { type: 'uuid', notNull: true, references: 'shops', onDelete: 'CASCADE' },
        device_id: { type: 'varchar(100)', references: 'iot_devices(device_id)', onDelete: 'SET NULL' },
        dispense_record_id: { type: 'uuid', references: 'dispense_records', onDelete: 'SET NULL' },
        severity: { type: 'varchar(20)', notNull: true },
        description: { type: 'text', notNull: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        resolved_at: { type: 'timestamp' },
        auto_resolved_at: { type: 'timestamp' },
    }, { ifNotExists: true });

    pgm.createIndex('anomaly_flags', 'shop_id', { ifNotExists: true });
    pgm.createIndex('anomaly_flags', 'rule_key', { ifNotExists: true });
    pgm.createIndex('anomaly_flags', ['resolved_at', 'auto_resolved_at'], { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('anomaly_flags', { ifExists: true });
};
