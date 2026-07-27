/* eslint-disable camelcase */
// IoT weighing subsystem, Phase 1 — registry of ESP32 devices allowed to open
// a device WSS connection at /ws/iot. Tokens are bcrypt-hashed (never stored
// in plaintext, same as users.password_hash) and rotate-able via
// iotController.rotateToken without a new migration.
exports.up = (pgm) => {
    pgm.createTable('iot_devices', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        device_id: { type: 'varchar(100)', notNull: true, unique: true },
        device_token_hash: { type: 'text', notNull: true },
        shop_id: { type: 'uuid', notNull: true, references: 'shops', onDelete: 'CASCADE' },
        status: { type: 'varchar(20)', notNull: true, default: 'active' }, // 'active' | 'revoked' | 'inactive'
        token_expires_at: { type: 'timestamp' }, // NULL = no expiry
        last_seen_at: { type: 'timestamp' },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    }, { ifNotExists: true });

    pgm.createIndex('iot_devices', 'shop_id', { ifNotExists: true });
    pgm.createIndex('iot_devices', 'status', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('iot_devices', { ifExists: true });
};
