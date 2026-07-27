/* eslint-disable camelcase */
// Phase 3 — GET /api/admin/iot/anchor-status wants a "last failure reason,"
// but nothing persists *why* an anchor attempt failed today (only whether
// blockchain_tx_hash ended up NULL or not — success/failure outcomes are
// tracked in blockchainService.js's in-memory ring buffer, which doesn't
// carry the error message either). Adding a column anchorEnqueuer.js writes
// to on failure.
exports.up = (pgm) => {
    pgm.addColumns('dispense_records', {
        last_anchor_error: { type: 'text' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('dispense_records', ['last_anchor_error'], { ifExists: true });
};
