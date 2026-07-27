const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const dispenseSessionBus = require("../services/dispenseSessionBus");
const { shopkeeperSubscribeFrameSchema } = require("../validators/iotFrames");

const extractSubprotocol = (req) => {
    const header = req.headers["sec-websocket-protocol"];
    if (!header) return null;
    return header.split(",")[0].trim() || null;
};

// Creates the shopkeeper-facing WebSocket server for /ws/shopkeeper/live —
// pushes dispense-session state-machine events (weighing/confirming
// countdown/committed/cancelled/device_lost/failed_insufficient_balance) to
// the shopkeeper's own dispense screen. Same auth pattern as
// adminSocketServer.js (JWT via Sec-WebSocket-Protocol, since a browser
// WebSocket can't set an Authorization header), just a different role.
const createShopkeeperSocketServer = () => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws, req, shopkeeper) => {
        logger.info("[IoT] Shopkeeper dispense-session view connected", { shopkeeperId: shopkeeper.id });

        let unsubscribe = null;

        ws.on("message", (raw) => {
            let parsed;
            try {
                parsed = JSON.parse(raw.toString());
            } catch (err) {
                logger.warn("[IoT] Dropped malformed shopkeeper frame", { shopkeeperId: shopkeeper.id });
                return;
            }

            const { error, value } = shopkeeperSubscribeFrameSchema.validate(parsed);
            if (error) {
                logger.warn("[IoT] Dropped invalid shopkeeper frame", {
                    shopkeeperId: shopkeeper.id,
                    message: error.message,
                });
                return;
            }

            if (unsubscribe) {
                unsubscribe();
            }

            unsubscribe = dispenseSessionBus.subscribe(value.sessionId, (payload) => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify(payload));
                }
            });
        });

        ws.on("close", () => {
            if (unsubscribe) {
                unsubscribe();
            }
            logger.info("[IoT] Shopkeeper dispense-session view disconnected", { shopkeeperId: shopkeeper.id });
        });

        ws.on("error", (err) => {
            logger.error("[IoT] Shopkeeper socket error", { shopkeeperId: shopkeeper.id, message: err.message });
        });
    });

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
            logger.warn("[IoT] Rejected shopkeeper WS handshake", { message: err.message });
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        if (decoded.role !== "shopkeeper") {
            logger.warn("[IoT] Rejected shopkeeper WS handshake: wrong role", { role: decoded.role });
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

module.exports = { createShopkeeperSocketServer };
