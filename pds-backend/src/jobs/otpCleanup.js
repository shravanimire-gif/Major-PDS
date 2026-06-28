const cron = require("node-cron");
const pool = require("../config/db");
const logger = require("../config/logger");

const startOtpCleanupCron = () => {
    cron.schedule("0 * * * *", async () => {
        try {
            // Backward-compatible schema guard for environments created before `is_used` existed.
            await pool.query(`
        ALTER TABLE otp_verifications
        ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT false
      `);

            const result = await pool.query(`
        UPDATE otp_verifications
        SET is_used = true
        WHERE is_used = false AND expires_at < NOW()
      `);
            logger.info("[Cron] OTP cleanup done", { updated: result.rowCount });
        } catch (err) {
            logger.error("[Cron] OTP cleanup failed", { error: err.message });
        }
    });

    logger.info("[Cron] OTP cleanup job scheduled — runs every hour");
};

module.exports = { startOtpCleanupCron };
