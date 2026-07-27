const client = require("prom-client");

// GET /metrics — new prom-client dependency, no Prometheus server stood up
// (per the DO-NOT list); just expose the endpoint for ops to scrape later.
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const readingsCounter = new client.Counter({
    name: "iot_readings_total",
    help: "Total sensor readings persisted, by device",
    labelNames: ["device_id"],
    registers: [register],
});

const sessionsCounter = new client.Counter({
    name: "iot_dispense_sessions_total",
    help: "Total dispense sessions opened, by shop",
    labelNames: ["shop_id"],
    registers: [register],
});

const commitLatencyHistogram = new client.Histogram({
    name: "iot_commit_latency_seconds",
    help: "Latency of dispenseSessionService.commitSession's transaction",
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
});

// Pull-based: computed at scrape time rather than kept continuously in
// sync, since nothing else in the app needs this value live.
// eslint-disable-next-line no-new
new client.Gauge({
    name: "iot_anchor_retry_backlog",
    help: "Current count of dispense_records with blockchain_tx_hash IS NULL",
    registers: [register],
    async collect() {
        // Required lazily to avoid a require-cycle at module-load time
        // (anchorStatusService -> config/db, nothing back to metrics.js).
        const anchorStatusService = require("../services/anchorStatusService");
        const status = await anchorStatusService.getAnchorStatus();
        this.set(status.pending_count);
    },
});

module.exports = { register, readingsCounter, sessionsCounter, commitLatencyHistogram };
