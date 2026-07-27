/* eslint-disable camelcase */
// Phase 3 — token rotation grace window: rotateToken keeps the previous
// hash usable for 5 more minutes (see PHASE3_DONE.md) so an ESP32 already
// mid-reconnect-backoff with the old token isn't hard-locked out the
// instant an admin rotates it.
exports.up = (pgm) => {
    pgm.addColumns('iot_devices', {
        previous_token_hash: { type: 'text' },
        previous_token_expires_at: { type: 'timestamp' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('iot_devices', ['previous_token_hash', 'previous_token_expires_at'], { ifExists: true });
};
