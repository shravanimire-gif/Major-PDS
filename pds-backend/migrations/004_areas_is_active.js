/* eslint-disable camelcase */
exports.up = (pgm) => {
    pgm.addColumns('areas', {
        is_active: {
            type: 'boolean',
            notNull: true,
            default: true,
            ifNotExists: true,
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('areas', ['is_active']);
};
