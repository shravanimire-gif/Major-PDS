const { createIotSocketServer } = require("./iotSocketServer");
const { createAdminSocketServer } = require("./adminSocketServer");
const { createShopkeeperSocketServer } = require("./shopkeeperSocketServer");
const logger = require("../config/logger");
const { WS_UPGRADE_RATE_LIMIT_WINDOW_MS, WS_UPGRADE_RATE_LIMIT_MAX } = require("../config/iot");

// Per-IP sliding-window limiter on /ws/iot connection *attempts* specifically
// (not admin/shopkeeper WS — those already require a valid JWT before the
// handshake completes, unlike a device token which is cheaper to guess/
// brute-force at volume). express-rate-limit's middleware can't run on a raw
// http.Server 'upgrade' event (it's not an Express request/response cycle),
// so this mirrors its windowMs/max shape rather than reusing the package.
const attemptsByIp = new Map();

const isRateLimited = (ip) => {
    const now = Date.now();
    const timestamps = (attemptsByIp.get(ip) || []).filter(
        (ts) => now - ts <= WS_UPGRADE_RATE_LIMIT_WINDOW_MS,
    );
    timestamps.push(now);
    attemptsByIp.set(ip, timestamps);
    return timestamps.length > WS_UPGRADE_RATE_LIMIT_MAX;
};

// Single source of truth for wiring all WS servers onto a shared HTTP
// server's 'upgrade' event, routed by URL path. Used by src/server.js at
// boot, and directly by tests that need a real WS-capable server (e.g.
// tests/dispenseSessionWs.test.js) without duplicating the dispatch logic.
const attachWebSocketServers = (httpServer) => {
    const iotSocket = createIotSocketServer();
    const adminSocket = createAdminSocketServer();
    const shopkeeperSocket = createShopkeeperSocketServer();

    httpServer.on("upgrade", (req, socket, head) => {
        const { pathname } = new URL(req.url, "http://internal");

        if (pathname === "/ws/iot") {
            const ip = req.socket.remoteAddress || "unknown";
            if (isRateLimited(ip)) {
                logger.warn("[IoT] Rate-limited /ws/iot connection attempt", { ip });
                socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
                socket.destroy();
                return;
            }
            iotSocket.handleUpgrade(req, socket, head);
        } else if (pathname === "/ws/admin/live") {
            adminSocket.handleUpgrade(req, socket, head);
        } else if (pathname === "/ws/shopkeeper/live") {
            shopkeeperSocket.handleUpgrade(req, socket, head);
        } else {
            socket.destroy();
        }
    });

    return { iotSocket, adminSocket, shopkeeperSocket };
};

module.exports = { attachWebSocketServers };
