/* eslint-disable camelcase */
// Phase 3 — the DEVICE_ANOMALY rule needs a 24h rejection *rate*
// (rejected / total), but rejected readings were never persisted anywhere
// (persistReading intentionally "drops" them, per Phase 2's error-handling
// design) — only a transient in-memory 60s/3-strikes counter existed. This
// is a lightweight append-only log of rejection *events* (no grams value —
// the point is only "a rejection happened, when"), written alongside that
// existing in-memory counter in iotController.recordRejectionAndMaybeFlag,
// not replacing it.
exports.up = (pgm) => {
    pgm.createTable('sensor_reading_rejections', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        device_id: { type: 'varchar(100)', notNull: true, references: 'iot_devices(device_id)', onDelete: 'CASCADE' },
        rejected_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    }, { ifNotExists: true });

    pgm.createIndex('sensor_reading_rejections', ['device_id', 'rejected_at'], { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('sensor_reading_rejections', { ifExists: true });
};
