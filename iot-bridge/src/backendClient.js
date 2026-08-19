const { EventEmitter } = require("events");
const WebSocket = require("ws");
const { buildWsUrl } = require("./config");
const logger = require("./logger");

/**
 * backendClient.js
 *
 * The bridge's connection to pds-backend, speaking the EXISTING device
 * protocol — the same one iot-device/ws_client.cpp speaks over Wi-Fi:
 *
 *   ws://host/ws/iot?deviceId=<uid>
 *   Sec-WebSocket-Protocol: <device bearer token>
 *   {"type":"hello",...} {"type":"reading","grams":N,"ts":epochMs} {"type":"heartbeat","ts":epochMs}
 *
 * No new endpoint, no second authentication mechanism, no REST fallback. The
 * USB transport changes how a weight reaches the PC; it does not change how a
 * device authenticates to the PDS backend.
 *
 * WHAT THIS CLIENT WILL NOT DO
 * It has no database connection, no knowledge of wallets, entitlements,
 * tolerances or ration cards, and no way to create a transaction. It forwards
 * measurements and hardware faults. Every authorisation decision — is there an
 * active session, does the device's shop match it, is the measurement within
 * tolerance, may the wallet be debited — is made by the backend, inside one
 * database transaction, in dispenseSessionService.commitSession.
 */
class BackendClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.ws = null;
        this.deviceId = null;
        this.firmware = null;
        this.connected = false;
        this.stopped = false;
        this.backoffMs = config.reconnectInitialMs;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.lastError = null;
        this.readingsForwarded = 0;
        this.readingsDropped = 0;
    }

    /**
     * @param {string} deviceId The UID the board reported (or the pinned one).
     * @param {string|null} firmware The firmware version to announce in `hello`.
     */
    start(deviceId, firmware) {
        this.deviceId = deviceId;
        this.firmware = firmware || null;
        this.stopped = false;
        this._connect();
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.reconnectTimer);
        clearInterval(this.heartbeatTimer);
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        if (this.ws) {
            try {
                this.ws.close(1000, "bridge shutting down");
            } catch (_) {
                // Already closing — nothing to do.
            }
            this.ws = null;
        }
        this.connected = false;
    }

    /** Announces the device's firmware version. Carries no business fields. */
    _sendHello() {
        this._send({
            type: "hello",
            deviceId: this.deviceId,
            firmware: this.firmware,
            transport: "serial",
        });
    }

    /**
     * Updates the firmware version and re-announces it if the socket is already
     * open.
     *
     * Needed because the two facts arrive in either order. With IOT_DEVICE_ID
     * pinned, the bridge connects immediately at startup — before the board has
     * said anything — so the first `hello` necessarily carries a null firmware.
     * The board's own hello lands moments later, and without this the version it
     * reported would never reach the backend: iot_devices.firmware_version would
     * sit at NULL for exactly the setup that pins a device, and the Admin Panel
     * would show a blank Firmware column for a perfectly healthy scale.
     *
     * A no-op when the version has not changed, so a board that re-announces
     * after a reset does not re-send an identical frame.
     */
    announceFirmware(firmware) {
        if (!firmware || firmware === this.firmware) {
            return false;
        }
        this.firmware = firmware;
        if (!this.connected) {
            // Nothing to re-announce yet — the next _sendHello() on connect will
            // carry the new value.
            return false;
        }
        this._sendHello();
        return true;
    }

    _send(frame) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }
        try {
            this.ws.send(JSON.stringify(frame));
            return true;
        } catch (err) {
            logger.warn(`Failed to send ${frame.type} frame: ${err.message}`);
            return false;
        }
    }

    /**
     * Forwards one weight reading.
     *
     * `ts` is the PC's wall clock, not the board's millis(): the USB build has
     * no RTC and no NTP, so the only correct epoch time available is this
     * machine's — and a timestamp the device cannot influence is the one the
     * audit trail should carry.
     */
    sendReading(grams) {
        const sent = this._send({ type: "reading", grams, ts: Date.now() });
        if (sent) {
            this.readingsForwarded += 1;
        } else {
            // Not queued. A weight is only meaningful at the moment it was
            // measured; replaying a 30-second-old reading into a live weighing
            // session would feed the stability detector a value that no longer
            // describes what is on the pan.
            this.readingsDropped += 1;
        }
        return sent;
    }

    sendHeartbeat() {
        return this._send({ type: "heartbeat", ts: Date.now() });
    }

    /** Relays a hardware fault the board reported. Never carries a grams value. */
    sendDeviceError(code, detail) {
        return this._send({ type: "error", code, ts: Date.now(), detail: detail || null });
    }

    _scheduleReconnect() {
        if (this.stopped || this.reconnectTimer) return;

        const delay = this.backoffMs;
        this.backoffMs = Math.min(this.backoffMs * 2, this.config.reconnectMaxMs);

        logger.info(`Reconnecting to the backend in ${Math.round(delay / 1000)}s...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._connect();
        }, delay);
    }

    _connect() {
        if (this.stopped) return;

        const url = buildWsUrl(this.deviceId, this.config);
        logger.debug(`Opening ${url}`);

        // The token rides in Sec-WebSocket-Protocol, exactly as the backend's
        // handshake expects, and deliberately NOT in the URL — URLs end up in
        // logs, proxy access records and process listings.
        const ws = new WebSocket(url, [this.config.deviceToken]);
        this.ws = ws;

        ws.on("open", () => {
            this.connected = true;
            this.lastError = null;
            this.backoffMs = this.config.reconnectInitialMs;

            logger.info("Device authenticated — backend connection established");
            this._sendHello();

            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.config.heartbeatMs);

            this.emit("open");
        });

        ws.on("message", (raw) => {
            // The backend's only device-bound message today is
            // {"type":"recalibrate"}. Surfaced rather than acted on: an
            // automatic tare while grain is on the pan would zero a real
            // measurement, so the operator performs it (`t` in the Serial
            // Monitor, or the documented calibration procedure).
            let parsed;
            try {
                parsed = JSON.parse(raw.toString());
            } catch (_) {
                logger.debug(`Ignored non-JSON message from backend: ${raw.toString().slice(0, 120)}`);
                return;
            }
            if (parsed?.type === "recalibrate") {
                logger.warn(
                    "Backend requested RECALIBRATION of this device. Follow the calibration " +
                    "procedure in iot-device/README_USB_SERIAL.md before the next dispense.",
                );
            }
            this.emit("message", parsed);
        });

        ws.on("close", (code, reasonBuf) => {
            const wasConnected = this.connected;
            this.connected = false;
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;

            const reason = reasonBuf?.toString() || "";

            // 1008 (policy violation) is what the backend sends when an admin
            // action invalidated this connection — device disabled, revoked,
            // unassigned or reassigned to another shop. Reconnecting is correct
            // (the admin may be mid-reassignment) but the operator needs to know
            // why the scale went offline, because the fix is in the Admin Panel,
            // not in the cable.
            if (code === 1008) {
                logger.warn(
                    `Backend closed the connection: ${reason || "policy violation"}. ` +
                    "The device was disabled, revoked or reassigned in the Admin Panel.",
                );
            } else if (wasConnected) {
                logger.warn(`Backend connection closed (code ${code}${reason ? `: ${reason}` : ""})`);
            }

            this.emit("close", { code, reason });
            this._scheduleReconnect();
        });

        ws.on("error", (err) => {
            this.lastError = err.message;

            // `ws` reports a rejected handshake as "Unexpected server response:
            // <status>". Translated here because the raw message gives the
            // operator nothing to act on, and each status has a different fix.
            if (/Unexpected server response: 401/.test(err.message)) {
                logger.error(
                    "Backend refused the device (HTTP 401). One of: the token in " +
                    "IOT_DEVICE_TOKEN is wrong or was rotated; this device_id is not registered; " +
                    "the device is disabled/revoked; or the device is not assigned to a shop. " +
                    `Check Settings > Devices in the Admin Panel for "${this.deviceId}".`,
                );
            } else if (/Unexpected server response: 429/.test(err.message)) {
                logger.error(
                    "Backend rate-limited the connection attempt (HTTP 429). Too many /ws/iot " +
                    "handshakes from this machine — the bridge will back off and retry.",
                );
            } else if (err.code === "ECONNREFUSED") {
                logger.error(
                    `Cannot reach the backend at ${this.config.backendUrl} (connection refused). ` +
                    "Is `npm run dev` running?",
                );
            } else {
                logger.error(`Backend socket error: ${err.message}`);
            }

            this.emit("socket-error", err);
            // No reconnect scheduled here: `ws` always emits 'close' after
            // 'error', and scheduling in both would double the retry rate.
        });
    }

    /** Non-secret snapshot for the local health endpoint. */
    describe() {
        return {
            connected: this.connected,
            deviceId: this.deviceId,
            firmware: this.firmware,
            backendUrl: this.config.backendUrl,
            wsPath: this.config.backendWsPath,
            lastError: this.lastError,
            readingsForwarded: this.readingsForwarded,
            readingsDropped: this.readingsDropped,
            nextRetryInMs: this.reconnectTimer ? this.backoffMs : null,
        };
    }
}

module.exports = { BackendClient };
