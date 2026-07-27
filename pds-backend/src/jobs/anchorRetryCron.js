const cron = require("node-cron");
const pool = require("../config/db");
const logger = require("../config/logger");
const { enqueueAnchor } = require("../services/anchorEnqueuer");

// New infrastructure — no retry worker exists anywhere in this codebase
// today (see block-ref.md §9/§10: `transactions.blockchain_tx_hash IS NULL`
// rows have never been auto-resubmitted). Mirrors block-ref.md §10's own
// suggested extension, applied to dispense_records instead of transactions.
// 5-minute grace period matches PENDING_ANCHOR_GRACE_PERIOD_MINUTES in
// src/config/blockchainHealth.js — a freshly-committed record is expected to
// still be NULL for a short while (recordDispense awaits 1 confirmation).
const runAnchorRetry = async () => {
    const result = await pool.query(
        `SELECT id FROM dispense_records
     WHERE blockchain_tx_hash IS NULL
       AND committed_at < NOW() - INTERVAL '5 minutes'`,
    );

    if (result.rows.length === 0) {
        return;
    }

    logger.info("[AnchorRetry] Re-submitting pending anchors", { count: result.rows.length });
    for (const row of result.rows) {
        await enqueueAnchor(row.id);
    }
};

const startAnchorRetryCron = () => {
    cron.schedule("*/5 * * * *", () => {
        runAnchorRetry().catch((err) =>
            logger.error("[AnchorRetry] Cron run failed", { message: err.message }),
        );
    });

    logger.info("[Cron] Anchor retry job scheduled — runs every 5 minutes");
};

module.exports = { startAnchorRetryCron, runAnchorRetry };
