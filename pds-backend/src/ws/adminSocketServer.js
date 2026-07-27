const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const liveReadingBus = require("../services/liveReadingBus");
const anomalyBus = require("../services/anomalyBus");
const { adminSubscribeFrameSchema } = require("../validators/iotFrames");

const extractSubprotocol = (req) => {
    const header = req.headers["sec-websocket-protocol"];
    if (!header) return null;
    return header.split(",")[0].trim() || null;
};

// Creates the admin-facing WebSocket server for /ws/admin/live. A browser
// WebSocket can't set an Authorization header, so the admin JWT rides in
// Sec-WebSocket-Protocol instead (new WebSocket(url, [jwtToken])) — same
// mechanism used for device auth in iotSocketServer.js, for consistency and
// so the token never sits in a logged URL query string.
const createAdminSocketServer = () => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws, req, admin) => {
        logger.info("[IoT] Admin live-view connected", { adminId: admin.id });

        let unsubscribe = null;

        // Every connected admin gets the dashboard-wide unresolved-critical
        // count regardless of which shop (if any) they later subscribe to —
        // there's no per-shop scoping for this, unlike liveReadingBus.
        const unsubscribeAnomalies = anomalyBus.subscribe((payload) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify(payload));
            }
        });

        ws.on("message", (raw) => {
            let parsed;
            try {
                parsed = JSON.parse(raw.toString());
            } catch (err) {
                logger.warn("[IoT] Dropped malformed admin frame", { adminId: admin.id });
                return;
            }

            const { error, value } = adminSubscribeFrameSchema.validate(parsed);
            if (error) {
                logger.warn("[IoT] Dropped invalid admin frame", { adminId: admin.id, message: error.message });
                return;
            }

            if (unsubscribe) {
                unsubscribe();
            }

            unsubscribe = liveReadingBus.subscribe(value.shopId, (payload) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify(payload));
                }
            });
        });

        ws.on("close", () => {
            if (unsubscribe) {
                unsubscribe();
            }
            unsubscribeAnomalies();
            logger.info("[IoT] Admin live-view disconnected", { adminId: admin.id });
        });

        ws.on("error", (err) => {
            logger.error("[IoT] Admin socket error", { adminId: admin.id, message: err.message });
        });
    });

    // Verifies the admin JWT (same secret/role check as middleware/auth.js's
    // verifyToken + requireRole('admin')) before completing the handshake.
    const handleUpgrade = (req, socket, head) => {
        const token = extractSubprotocol(req);

        if (!token) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            logger.warn("[IoT] Rejected admin WS handshake", { message: err.message });
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        if (decoded.role !== "admin") {
            logger.warn("[IoT] Rejected admin WS handshake: wrong role", { role: decoded.role });
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req, decoded);
        });
    };

    return { wss, handleUpgrade };
};

module.exports = { createAdminSocketServer };
