/* eslint-disable camelcase */
// Phase 3 — audit trail for IoT-related admin actions (see
// services/auditLogService.js): token rotation, recalibration trigger,
// manual session cancel, manual anomaly-flag resolve.
exports.up = (pgm) => {
    pgm.createTable('iot_audit', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        actor_type: { type: 'varchar(20)', notNull: true }, // 'admin' | 'shopkeeper' | 'system'
        actor_id: { type: 'uuid' },
        action: { type: 'varchar(50)', notNull: true },
        target: { type: 'text', notNull: true },
        at_time: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        meta_json: { type: 'jsonb', notNull: true, default: '{}' },
    }, { ifNotExists: true });

    pgm.createIndex('iot_audit', 'action', { ifNotExists: true });
    pgm.createIndex('iot_audit', 'at_time', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('iot_audit', { ifExists: true });
};
