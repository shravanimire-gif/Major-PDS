/* eslint-disable camelcase */
// Phase 2 — single-use enforcement for dispense_sessions' signed session
// JWTs (the "session_jwt" returned from POST /api/dispense/session). A jti
// is inserted here the moment it's consumed by /attach; a second attempt
// with the same jti is a replay -> 409 IOT_SESSION_ALREADY_USED.
exports.up = (pgm) => {
    pgm.createTable('used_jtis', {
        jti: { type: 'text', primaryKey: true },
        session_id: { type: 'uuid', notNull: true, references: 'dispense_sessions', onDelete: 'CASCADE' },
        used_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
    }, { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('used_jtis', { ifExists: true });
};
