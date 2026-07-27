/* eslint-disable camelcase */
// Phase 2 — an IoT-gated dispense session. Created by a shopkeeper (after
// they've already scanned+validated the beneficiary's existing qr_sessions
// QR — see iot-device/PHASE2_DONE.md), attached to the shop's ESP32, then
// driven through the weighing/confirming state machine by
// ws/iotSocketServer.js as readings arrive.
exports.up = (pgm) => {
    pgm.createTable('dispense_sessions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        shop_id: { type: 'uuid', notNull: true, references: 'shops', onDelete: 'CASCADE' },
        ration_card_id: { type: 'uuid', notNull: true, references: 'ration_cards', onDelete: 'CASCADE' },
        commodity: { type: 'varchar(20)', notNull: true }, // 'rice' | 'wheat' | 'sugar'
        entitled_grams: { type: 'integer', notNull: true },
        tolerance_grams: { type: 'integer', notNull: true },
        // Set on attach — which ESP32 (iot_devices.device_id) is gating this session.
        device_id: { type: 'varchar(100)', references: 'iot_devices(device_id)', onDelete: 'SET NULL' },
        // active -> attached -> weighing -> confirming -> committed
        //                                            \-> (back to weighing if the rule breaks)
        // any of attached/weighing/confirming -> cancelled | device_lost
        // active -> failed_insufficient_balance (checked at creation) | expired
        state: { type: 'varchar(30)', notNull: true, default: 'active' },
        opened_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        expires_at: { type: 'timestamp', notNull: true },
        attached_at: { type: 'timestamp' },
        committed_at: { type: 'timestamp' },
    }, { ifNotExists: true });

    // The exact lookup ws/iotSocketServer.js runs on every incoming reading:
    // "is there an attached/weighing session for this device right now?"
    pgm.createIndex('dispense_sessions', ['device_id', 'state'], { ifNotExists: true });
    pgm.createIndex('dispense_sessions', 'shop_id', { ifNotExists: true });
    pgm.createIndex('dispense_sessions', 'ration_card_id', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('dispense_sessions', { ifExists: true });
};
