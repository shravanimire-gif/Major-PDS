const cron = require("node-cron");
const { runEntitlementAllocation } = require("../services/entitlementService");
const logger = require("../config/logger");

const startEntitlementCron = () => {
  cron.schedule(
    "0 6 1 * *",
    async () => {
      logger.info('[Cron] Monthly entitlement started');
      try {
        const result = await runEntitlementAllocation();
        logger.info('[Cron] Done', { processed: result.processed });
      } catch (err) {
        logger.error('[Cron] Failed', { error: err.message });
      }
    },
    { timezone: "Asia/Kolkata" },
  );

  logger.info('[Cron] Entitlement job scheduled — runs 1st of every month at 6AM IST');
};

module.exports = { startEntitlementCron };
