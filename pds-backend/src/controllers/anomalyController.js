const logger = require("../config/logger");
const anomalyRulesService = require("../services/anomalyRulesService");
const auditLogService = require("../services/auditLogService");
const { publishAnomalySummary, runAnomalyRulesAndPublish } = require("../jobs/anomalyRulesCron");

// GET /api/admin/anomalies
const listFlags = async (req, res, next) => {
    try {
        const { severity, resolved, shop_id: shopId } = req.query;
        const flags = await anomalyRulesService.listFlags({ severity, resolved, shopId });
        return res.status(200).json({ flags });
    } catch (err) {
        return next(err);
    }
};

// POST /api/admin/anomalies/:id/resolve
const resolveFlag = async (req, res, next) => {
    try {
        const flag = await anomalyRulesService.resolveFlag(req.params.id);
        if (!flag) {
            return res.status(404).json({ error: "Flag not found or already resolved" });
        }

        await auditLogService.record({
            actorType: "admin",
            actorId: req.user?.id,
            action: "resolve_anomaly_flag",
            target: req.params.id,
            meta: { ruleKey: flag.rule_key, shopId: flag.shop_id },
        });

        publishAnomalySummary().catch((err) =>
            logger.error("[Anomaly] Failed to republish summary after resolve", { message: err.message }),
        );

        return res.status(200).json({ flag });
    } catch (err) {
        return next(err);
    }
};

// POST /api/admin/anomalies/run-now — lets an operator force an immediate
// re-scan instead of waiting for the next scheduled tick (also what the E2E
// suite uses to test the anomaly dropdown deterministically, rather than
// waiting on the real 5-minute cron).
const runNow = async (req, res, next) => {
    try {
        await runAnomalyRulesAndPublish();
        return res.status(200).json({ message: "Anomaly rules re-evaluated" });
    } catch (err) {
        return next(err);
    }
};

module.exports = { listFlags, resolveFlag, runNow };
