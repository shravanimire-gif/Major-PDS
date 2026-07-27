/* eslint-disable camelcase */
// IoT weighing subsystem, Phase 1 — raw weight readings streamed from an
// ESP32 over /ws/iot. session_id is nullable and unconstrained for now: this
// phase streams continuously (no session-gating, see iot-device/PHASE1_DONE.md),
// so every row's session_id is NULL. It's typed varchar(150) to match
// qr_sessions.session_id so Phase 2 can add the FK without a type change.
exports.up = (pgm) => {
    pgm.createTable('sensor_readings', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        device_id: { type: 'varchar(100)', notNull: true, references: 'iot_devices(device_id)', onDelete: 'CASCADE' },
        grams_int: { type: 'integer', notNull: true },
        taken_at: { type: 'timestamp', notNull: true },
        session_id: { type: 'varchar(150)' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    }, { ifNotExists: true });

    pgm.createIndex('sensor_readings', 'device_id', { ifNotExists: true });
    pgm.createIndex('sensor_readings', 'taken_at', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('sensor_readings', { ifExists: true });
};
