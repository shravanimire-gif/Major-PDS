/* eslint-disable camelcase */
// Adds the anomaly_events table (no anomaly-detection module existed before
// this — see src/jobs/anomalyDetectionCron.js for the minimal seed detector
// that populates it) and an index on transactions.created_at, which every
// new analytics/activity-feed query filters or orders by.
exports.up = (pgm) => {
    pgm.createTable('anomaly_events', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        type: { type: 'varchar(50)', notNull: true },
        severity: { type: 'varchar(20)', notNull: true }, // 'info' | 'warning' | 'critical'
        shop_code: { type: 'varchar(20)' },
        transaction_id: { type: 'uuid', references: 'transactions', onDelete: 'SET NULL' },
        description: { type: 'text', notNull: true },
        created_at: { type: 'timestamp', notNull: true, default: pgm.func('NOW()') },
        resolved: { type: 'boolean', notNull: true, default: false },
    }, { ifNotExists: true });

    pgm.createIndex('anomaly_events', 'created_at', { ifNotExists: true });
    pgm.createIndex('anomaly_events', 'resolved', { ifNotExists: true });
    pgm.createIndex('anomaly_events', 'transaction_id', { ifNotExists: true });

    // Every new analytics query (distribution trend, entitlement-vs-actual,
    // activity feed) filters/orders transactions by created_at; only
    // shop_id/ration_card_id were indexed before this.
    pgm.createIndex('transactions', 'created_at', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropIndex('transactions', 'created_at', { ifExists: true });
    pgm.dropTable('anomaly_events', { ifExists: true });
};
