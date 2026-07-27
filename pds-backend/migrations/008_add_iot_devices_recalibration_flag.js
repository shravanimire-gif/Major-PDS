/* eslint-disable camelcase */
// Phase 2 — set when a device racks up >=3 sanity-ceiling rejections (see
// src/config/iot.js's REJECT_*) within a rolling 60s window. Additive-only,
// does not affect Phase 1's iot_devices.status (active/revoked/inactive),
// which remains the device lifecycle field; this is a separate, orthogonal
// "flagged for attention" signal.
exports.up = (pgm) => {
    pgm.addColumns('iot_devices', {
        needs_recalibration: { type: 'boolean', notNull: true, default: false, ifNotExists: true },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('iot_devices', ['needs_recalibration'], { ifExists: true });
};
