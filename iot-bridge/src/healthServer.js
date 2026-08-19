const http = require("http");
const logger = require("./logger");

/**
 * healthServer.js
 *
 * A one-route HTTP server exposing the bridge's own state:
 *
 *   GET http://127.0.0.1:5099/health
 *
 * WHY IT EXISTS
 * When the scale shows OFFLINE in the Admin Panel there are four possible
 * causes, in different places: the board is unplugged, the COM port is held by
 * the Arduino Serial Monitor, the backend is down, or the device is not
 * assigned/enabled. The Admin Panel can only ever report the symptom. This
 * endpoint reports which of the four it is, from the one process that knows.
 *
 * WHY IT IS LOOPBACK-ONLY
 * Bound to 127.0.0.1 rather than 0.0.0.0. It is an operator diagnostic for the
 * machine running the demo, not a service — nothing in the PDS system consumes
 * it, and it must not become reachable from the network.
 *
 * NO SECRETS. The payload comes from Bridge.describe(), which never includes the
 * device token, and every line the bridge prints goes through logger.redact().
 */
const startHealthServer = (bridge, config) => {
    const server = http.createServer((req, res) => {
        if (req.method !== "GET") {
            res.writeHead(405, { "Content-Type": "application/json", Allow: "GET" });
            res.end(JSON.stringify({ error: "method not allowed" }));
            return;
        }

        const path = (req.url || "/").split("?")[0];

        if (path === "/health" || path === "/") {
            const snapshot = bridge.describe();
            // 503 when the relay is not actually able to carry a reading, so
            // `curl -f` and any future watchdog can tell without parsing JSON.
            const healthy = snapshot.bridge.status === "online";
            res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
            res.end(JSON.stringify(snapshot, null, 2));
            return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found", routes: ["/health"] }));
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            // Non-fatal on purpose: the health endpoint is a convenience, and
            // losing it must never stop grain being weighed. The usual cause is
            // a second bridge instance, which is worth saying out loud since
            // that instance is also competing for the COM port.
            logger.warn(
                `Local health endpoint could not bind to ${config.healthHost}:${config.healthPort} ` +
                "(address in use — another bridge instance may already be running). Continuing without it.",
            );
        } else {
            logger.warn(`Local health endpoint error: ${err.message}. Continuing without it.`);
        }
    });

    server.listen(config.healthPort, config.healthHost, () => {
        logger.info(`Bridge health: http://${config.healthHost}:${config.healthPort}/health`);
    });

    return server;
};

module.exports = { startHealthServer };
