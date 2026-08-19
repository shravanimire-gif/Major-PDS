/* eslint-disable camelcase */
// USB/serial IoT integration — the ONLY schema change the physical-device
// work needed. Everything else the ESP32 -> bridge -> backend path touches
// (iot_devices, sensor_readings, dispense_sessions, dispense_records,
// transactions, wallets, policies, commodity_tolerances) already existed and
// is reused unchanged.
//
// Three additive changes, each traceable to a required behaviour rather than
// to "might be useful":
//
//   device_name       Admin Panel's device list shows a human-readable name
//                     next to the hardware UID. Nullable — the UID is the
//                     identity, the name is a label, and every read path
//                     falls back to device_id when it is NULL.
//
//   firmware_version  Admin Panel's device list shows it. Written by the
//                     backend from the version the device reports in its
//                     serial `hello` frame (relayed by the bridge), never
//                     supplied by an admin, so it always reflects the binary
//                     actually running on the board.
//
//   shop_id nullable  Admin Panel's "Unassign Device" action. A device with
//                     no shop is registered but inert: the /ws/iot handshake
//                     rejects it (deviceRegistryService.validateToken ->
//                     reason 'unassigned'), so it can neither stream readings
//                     nor be attached to a session. This is what makes
//                     unassign safe — the device/shop/session invariant
//                     (device.shop_id === session.shop_id) cannot be
//                     satisfied by a NULL, so nothing downstream can treat an
//                     unassigned device as authorised.
//
// NOT added, deliberately: updated_at. Nothing reads or displays it, and
// last_seen_at already carries the "when did this device last do something"
// signal the fleet view needs.
//
// No data is rewritten. No historical transaction, dispense_record, wallet or
// session row is touched.
exports.up = (pgm) => {
    pgm.sql(`
    ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS device_name      VARCHAR(150);
    ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50);
    ALTER TABLE iot_devices ALTER COLUMN shop_id DROP NOT NULL;
  `);
};

// Drops the two added columns. Deliberately does NOT restore NOT NULL on
// shop_id: doing so would require deleting every unassigned device row, and a
// down-migration must not silently destroy registry rows. A nullable shop_id
// is harmless to the pre-026 code — it only ever queried devices BY shop_id,
// so an unassigned row simply never matches.
exports.down = (pgm) => {
    pgm.sql(`
    ALTER TABLE iot_devices DROP COLUMN IF EXISTS device_name;
    ALTER TABLE iot_devices DROP COLUMN IF EXISTS firmware_version;
  `);
};
