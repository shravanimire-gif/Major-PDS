/* eslint-disable camelcase */
// Phase 3 — no column anywhere tracks when a device was last calibrated
// (calibration is entirely manual/on-device per iot-device/README.md). Set
// at registration and again whenever an admin triggers "Recalibrate" — see
// PHASE3_DONE.md for why this is optimistic (no firmware confirmation
// channel exists) rather than a guarantee.
exports.up = (pgm) => {
    pgm.addColumns('iot_devices', {
        calibrated_at: { type: 'timestamp' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('iot_devices', ['calibrated_at'], { ifExists: true });
};
