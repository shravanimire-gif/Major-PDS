/* eslint-disable camelcase */
exports.up = (pgm) => {
    pgm.addColumns('transactions', {
        blockchain_tx_hash: {
            type: 'text',
            ifNotExists: true,
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('transactions', ['blockchain_tx_hash']);
};
