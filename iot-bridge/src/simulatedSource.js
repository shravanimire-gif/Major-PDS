const { EventEmitter } = require("events");
const crypto = require("crypto");
const logger = require("./logger");

/**
 * simulatedSource.js
 *
 * A stand-in for SerialSource that produces readings with no COM port and no
 * board. Same interface (start/stop/write/describe, 'message'/'open' events), so
 * bridge.js cannot tell the difference — which is the point: it exercises the
 * real bridge, the real WebSocket protocol, the real backend, the real database
 * and the real Admin Panel, with only the physical sensor replaced.
 *
 * WHAT IT IS FOR
 * Verifying the software path when the hardware is not attached: that a device
 * shows ONLINE, that a session commits, that a wallet is debited exactly once,
 * that analytics and the activity feed pick the transaction up. Enabled only by
 * an explicit IOT_SIMULATE=true.
 *
 * WHAT IT IS NOT
 * It is not a hardware test and is not treated as one. It cannot show that the
 * HX711 is wired correctly, that the calibration factor is right, that the cell
 * is linear, or that the COM port opens — the four things only the physical
 * board can demonstrate. Every log line it emits is prefixed SIMULATED so no
 * screenshot of a successful run can be mistaken for one.
 *
 * The synthetic device UID is deterministic per machine (hostname-derived), so
 * repeated runs re-authenticate as the same registered device instead of
 * littering the registry with new rows.
 */
class SimulatedSource extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.timer = null;
        this.open = false;
        this.grams = 0;
        this.target = Math.max(0, Number(config.simulateTargetGrams) || 0);
        this.linesSeen = 0;
        this.linesUnparsed = 0;
        this.bootMs = Date.now();
    }

    // A stable fake UID that is visibly fake. "SIM32-" rather than "ESP32-" so
    // a simulated device can never be confused with real hardware in the
    // registry, the fleet view or a demo screenshot.
    deviceId() {
        if (this.config.deviceId) return this.config.deviceId;
        const digest = crypto.createHash("sha256").update(require("os").hostname()).digest("hex");
        return `SIM32-${digest.slice(0, 6).toUpperCase()}`;
    }

    start() {
        logger.warn("SIMULATED MODE — no serial port is being opened and no real load cell is involved.");
        logger.warn("SIMULATED MODE — this verifies the software path only. It is NOT a hardware test.");

        this.open = true;
        this.emit("open", { path: "SIMULATED", baud: this.config.serialBaud, port: null });

        this.emit("message", {
            type: "hello",
            deviceId: this.deviceId(),
            firmware: "simulated",
            transport: "serial",
            cellRatedGrams: this.config.HARDWARE_MAX_GRAMS,
            calibrated: true,
            calibrationFactor: 1,
            raw: "<simulated>",
        });

        // 10 Hz, matching the firmware's real sample rate — the backend's
        // stability rule needs >=15 readings inside a 3 s window, so a slower
        // simulation would never auto-confirm and would "prove" a bug that
        // isn't there.
        this.timer = setInterval(() => this._tick(), 100);
    }

    _tick() {
        // Ramps toward the target, then holds it with +/-1 g of jitter, which is
        // inside the stability detector's 5 g spread so a session can actually
        // confirm. Never exceeds the hardware ceiling: a simulator that
        // fabricated a 6 kg reading would be testing the rejection path while
        // pretending to test the happy one.
        if (this.grams < this.target) {
            this.grams = Math.min(this.target, this.grams + Math.max(1, Math.round(this.target / 40)));
        } else if (this.target > 0) {
            const jitter = [-1, 0, 0, 1][this.linesSeen % 4];
            this.grams = Math.max(0, Math.min(this.config.HARDWARE_MAX_GRAMS, this.target + jitter));
        }

        this.linesSeen += 1;
        this.emit("message", {
            type: "reading",
            grams: this.grams,
            deviceTs: Date.now() - this.bootMs,
            raw: "<simulated>",
        });
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
        this.open = false;
    }

    // Accepts the same commands the real board does so the bridge's command
    // path is exercised too; `t` (tare) resets the simulated pan to empty.
    write(line) {
        const command = String(line).trim();
        if (command === "t") {
            this.grams = 0;
            this.target = 0;
            logger.info("SIMULATED tare — pan reset to 0 g");
        } else if (command.startsWith("target")) {
            this.target = Math.max(0, Math.min(this.config.HARDWARE_MAX_GRAMS, Number(command.slice(6).trim()) || 0));
            logger.info(`SIMULATED target set to ${this.target} g`);
        }
        return true;
    }

    describe() {
        return {
            open: this.open,
            path: "SIMULATED",
            baud: this.config.serialBaud,
            chip: null,
            simulated: true,
            simulatedTargetGrams: this.target,
            configuredPort: this.config.serialPort || null,
            lastError: null,
            linesSeen: this.linesSeen,
            linesUnparsed: this.linesUnparsed,
        };
    }
}

module.exports = { SimulatedSource };
