const cron = require("node-cron");
const pool = require("../config/db");
const logger = require("../config/logger");
const anomalyRulesService = require("../services/anomalyRulesService");
const anomalyBus = require("../services/anomalyBus");
const { ANOMALY_RULES_INTERVAL_MINUTES } = require("../config/iot");

// Publishes the current unresolved-critical count to every connected admin
// (see ws/adminSocketServer.js) — called after every rule run, and exported
// so REST actions that change flag state (resolve) can trigger an
// immediate push instead of waiting for the next cron tick.
const publishAnomalySummary = async () => {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM anomaly_flags
     WHERE severity = 'critical' AND resolved_at IS NULL AND auto_resolved_at IS NULL`,
    );
    anomalyBus.publish({ type: "anomaly_summary", unresolvedCritical: result.rows[0].count });
};

// Directly callable (undecorated by the cron wrapper) so tests and the E2E
// seed script can run deterministically without waiting on a timer — same
// pattern as entitlementService.runEntitlementAllocation().
const runAnomalyRulesAndPublish = async () => {
    await anomalyRulesService.runAnomalyRules();
    await publishAnomalySummary();
};

const startAnomalyRulesCron = () => {
    cron.schedule(`*/${ANOMALY_RULES_INTERVAL_MINUTES} * * * *`, async () => {
        try {
            await runAnomalyRulesAndPublish();
        } catch (err) {
            logger.error("[AnomalyRules] Cron run failed", { message: err.message });
        }
    });

    logger.info(`[Cron] Anomaly rules job scheduled — runs every ${ANOMALY_RULES_INTERVAL_MINUTES} minutes`);
};

module.exports = { startAnomalyRulesCron, runAnomalyRulesAndPublish, publishAnomalySummary };
