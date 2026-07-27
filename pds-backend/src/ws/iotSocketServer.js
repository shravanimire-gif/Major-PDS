const { WebSocketServer } = require("ws");
const logger = require("../config/logger");
const deviceRegistryService = require("../services/deviceRegistryService");
const liveReadingBus = require("../services/liveReadingBus");
const iotController = require("../controllers/iotController");
const { deviceReadingFrameSchema } = require("../validators/iot");
const dispenseSessionService = require("../services/dispenseSessionService");
const dispenseSessionBus = require("../services/dispenseSessionBus");
const stabilityDetectorService = require("../services/stabilityDetectorService");
const deviceConnectionRegistry = require("../services/deviceConnectionRegistry");
const metrics = require("../config/metrics");
const { CONFIRM_COUNTDOWN_MS } = require("../config/iot");

// Device firmware pings every 15s (see iot-device/ws_client.cpp). If nothing
// — not even a ping — has arrived for 3 missed intervals, treat the socket as
// dead and terminate it rather than waiting on TCP to notice.
const STALE_SWEEP_INTERVAL_MS = 15_000;
const STALE_THRESHOLD_MS = 45_000;

const extractSubprotocol = (req) => {
    const header = req.headers["sec-websocket-protocol"];
    if (!header) return null;
    return header.split(",")[0].trim() || null;
};

// Creates the device-facing WebSocket server for /ws/iot. `noServer: true`
// because it shares the existing Express HTTP server (src/server.js) rather
// than listening on its own port; the returned `handleUpgrade` is called from
// server.js's single 'upgrade' dispatcher once the URL path matches.
const createIotSocketServer = () => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws, req, device) => {
        ws.lastActivity = Date.now();

        // Phase 2 dispense-session gating state, scoped to this one device
        // connection (one ESP32 = one connection = at most one active
        // session at a time) — no module-level map needed, and it's
        // naturally garbage-collected when the connection closes.
        let currentSessionId = null;
        let sessionReadings = [];
        let confirmTimer = null;

        const clearConfirmTimer = () => {
            if (confirmTimer) {
                clearTimeout(confirmTimer);
                confirmTimer = null;
            }
        };

        const resetSessionTracking = () => {
            currentSessionId = null;
            sessionReadings = [];
            clearConfirmTimer();
        };

        logger.info("[IoT] Device connected", {
            deviceId: device.device_id,
            shopId: device.shop_id,
        });

        deviceConnectionRegistry.registerConnection(device.device_id, ws);
        if (deviceConnectionRegistry.consumePendingRecalibration(device.device_id)) {
            ws.send(JSON.stringify({ type: "recalibrate" }));
            logger.info("[IoT] Resent queued recalibration request", {
                deviceId: device.device_id,
            });
        }

        deviceRegistryService.touchLastSeen(device.device_id).catch((err) => {
            logger.error("[IoT] Failed to update last_seen_at", {
                deviceId: device.device_id,
                message: err.message,
            });
        });

        liveReadingBus.publish(device.shop_id, {
            type: "device_status",
            online: true,
            deviceId: device.device_id,
        });

        ws.on("ping", () => {
            ws.lastActivity = Date.now();
        });

        ws.on("message", async (raw) => {
            ws.lastActivity = Date.now();

            let parsed;
            try {
                parsed = JSON.parse(raw.toString());
            } catch (err) {
                logger.warn("[IoT] Dropped malformed (non-JSON) frame", {
                    deviceId: device.device_id,
                });
                return;
            }

            const { error, value } = deviceReadingFrameSchema.validate(parsed);
            if (error) {
                logger.warn("[IoT] Dropped invalid frame", {
                    deviceId: device.device_id,
                    message: error.message,
                });
                // The sanity-ceiling rejection counter needs to see frames
                // rejected here too — Joi's own max(10000) on `grams` means
                // out-of-range readings are normally caught at this layer,
                // never reaching iotController.persistReading's own check.
                if (error.details?.some((detail) => detail.path.includes("grams"))) {
                    iotController.recordRejectionAndMaybeFlag(device.device_id);
                }
                return;
            }

            const takenAt = new Date(value.ts);

            // Phase 2 — dispense-session gating. Looked up fresh each
            // reading (cheap, indexed on (device_id, state)) rather than
            // cached, since attach/cancel happen over HTTP and this is the
            // simplest way to always see current truth. Looked up *before*
            // persisting so the real session UUID (not the device frame's
            // own always-null sessionId — Phase 1 firmware has no concept
            // of sessions) gets stamped onto sensor_readings.session_id,
            // which Phase 3's session-forensics reading trace depends on.
            const session = await dispenseSessionService.findAttachedSessionForDevice(device.device_id);

            const result = await iotController.persistReading(
                device.device_id,
                value.grams,
                session ? session.id : null,
                takenAt,
            );

            if (!result.success) {
                logger.warn("[IoT] Reading rejected", {
                    deviceId: device.device_id,
                    error: result.error,
                });
                return;
            }

            metrics.readingsCounter.inc({ device_id: device.device_id });

            liveReadingBus.publish(result.shopId, {
                type: "reading",
                deviceId: device.device_id,
                gramsInt: result.reading.grams_int,
                takenAt: result.reading.taken_at,
            });

            if (!session) {
                if (currentSessionId) {
                    resetSessionTracking();
                }
                return;
            }

            if (session.id !== currentSessionId) {
                resetSessionTracking();
                currentSessionId = session.id;
            }

            if (session.state === "attached") {
                await dispenseSessionService.beginWeighing(session.id);
            }

            const nowMs = Date.now();
            sessionReadings.push({ gramsInt: value.grams, takenAtMs: nowMs });
            sessionReadings = stabilityDetectorService.filterToWindow(sessionReadings, nowMs);

            dispenseSessionBus.publish(session.id, {
                type: "reading",
                gramsInt: value.grams,
                takenAt: takenAt.toISOString(),
            });

            const stable = stabilityDetectorService.isStable(
                sessionReadings,
                session.entitled_grams,
                session.tolerance_grams,
            );

            if (stable && session.state !== "confirming") {
                const began = await dispenseSessionService.beginConfirming(session.id);
                if (began) {
                    const sessionIdAtConfirmStart = session.id;
                    dispenseSessionBus.publish(session.id, {
                        type: "state",
                        state: "confirming",
                        msLeft: CONFIRM_COUNTDOWN_MS,
                    });

                    clearConfirmTimer();
                    confirmTimer = setTimeout(async () => {
                        confirmTimer = null;

                        // A device_lost/cancel/new-session may have happened
                        // while this timer was pending — don't act on stale state.
                        if (currentSessionId !== sessionIdAtConfirmStart) {
                            return;
                        }

                        if (sessionReadings.length === 0) {
                            logger.warn("[IoT] No readings left at confirm time — reverting to weighing", {
                                sessionId: sessionIdAtConfirmStart,
                            });
                            await dispenseSessionService.revertToWeighing(sessionIdAtConfirmStart);
                            return;
                        }

                        const measuredGrams = Math.round(
                            sessionReadings.reduce((sum, r) => sum + r.gramsInt, 0) / sessionReadings.length,
                        );

                        const result = await dispenseSessionService.commitSession(sessionIdAtConfirmStart, measuredGrams);
                        if (!result.success) {
                            logger.warn("[IoT] Auto-confirm commit failed", {
                                sessionId: sessionIdAtConfirmStart,
                                reason: result.reason,
                            });
                        }
                        resetSessionTracking();
                    }, CONFIRM_COUNTDOWN_MS);
                }
            } else if (!stable && session.state === "confirming") {
                clearConfirmTimer();
                await dispenseSessionService.revertToWeighing(session.id);
            }
        });

        ws.on("close", (code, reasonBuf) => {
            logger.info("[IoT] Device disconnected", {
                deviceId: device.device_id,
                code,
                reason: reasonBuf?.toString() || "",
            });
            deviceConnectionRegistry.unregisterConnection(device.device_id, ws);
            liveReadingBus.publish(device.shop_id, {
                type: "device_status",
                online: false,
                deviceId: device.device_id,
            });

            // Phase 2 — no partial commits on disconnect: any session this
            // device was gating moves to a terminal 'device_lost' state
            // rather than being left attached/weighing/confirming forever.
            clearConfirmTimer();
            dispenseSessionService.markDeviceLost(device.device_id).catch((err) => {
                logger.error("[IoT] Failed to mark device_lost on disconnect", {
                    deviceId: device.device_id,
                    message: err.message,
                });
            });
        });

        ws.on("error", (err) => {
            logger.error("[IoT] Device socket error", {
                deviceId: device.device_id,
                message: err.message,
            });
        });
    });

    const staleSweep = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (Date.now() - (ws.lastActivity || 0) > STALE_THRESHOLD_MS) {
                logger.warn("[IoT] Terminating stale device connection (no heartbeat)");
                ws.terminate();
            }
        });
    }, STALE_SWEEP_INTERVAL_MS);
    wss.on("close", () => clearInterval(staleSweep));

    // Validates the device's Sec-WebSocket-Protocol bearer token *before*
    // completing the WS handshake — an invalid token never gets a WS
    // connection at all, just a plain HTTP 401.
    const handleUpgrade = async (req, socket, head) => {
        const url = new URL(req.url, "http://internal");
        const deviceId = url.searchParams.get("deviceId");
        const token = extractSubprotocol(req);

        if (!deviceId || !token) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        let validation;
        try {
            validation = await deviceRegistryService.validateToken(deviceId, token);
        } catch (err) {
            logger.error("[IoT] Device token validation errored", {
                deviceId,
                message: err.message,
            });
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
            return;
        }

        if (!validation.ok) {
            logger.warn("[IoT] Rejected device WS handshake", {
                deviceId,
                reason: validation.reason,
            });
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req, validation.device);
        });
    };

    return { wss, handleUpgrade };
};

module.exports = { createIotSocketServer };
