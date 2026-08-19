const { EventEmitter } = require("events");
const { parseSerialLine } = require("./serialParser");
const { resolvePort, listSystemPorts } = require("./portDiscovery");
const logger = require("./logger");

/**
 * serialSource.js
 *
 * Owns the COM port. The ONLY component in the whole system that touches
 * serial: the React frontend never does (a browser cannot, and should not),
 * and pds-backend never does (it must run identically whether or not any
 * hardware is attached to the machine it happens to be on).
 *
 * Emits parsed messages ('message'), plus 'open' / 'closed' lifecycle events.
 *
 * ARDUINO IDE COEXISTENCE
 * Windows gives a COM port to exactly one process. While the Arduino Serial
 * Monitor has it, opening it here fails with "Access denied" — and that is the
 * single most common way this goes wrong during a demo. That specific error is
 * detected and reported as an instruction ("close the Serial Monitor"), not as
 * a stack trace, and the bridge keeps retrying so closing the monitor is all
 * that is needed to recover. No polling of the port itself while it is held,
 * and no attempt to force it open.
 *
 * DISCONNECT RECOVERY
 * The port is RE-RESOLVED on every reopen attempt rather than remembered.
 * Unplugging and replugging an ESP32 can bring it back on a different COM
 * number, so a cached path would have the bridge retrying a port that no longer
 * exists while the board sat unused on another one.
 */
class SerialSource extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.port = null;
        this.path = null;
        this.portInfo = null;
        this.open = false;
        this.stopped = false;
        this.backoffMs = config.reconnectInitialMs;
        this.retryTimer = null;
        this.lastError = null;
        this.linesSeen = 0;
        this.linesUnparsed = 0;

        // Logged once per distinct failure, then suppressed: an unplugged board
        // retried every few seconds would otherwise print the same paragraph
        // forever and bury whatever happens next.
        this._lastReportedProblem = null;
        this._rawAdcWarned = false;
    }

    start() {
        this.stopped = false;
        this._openWhenAvailable();
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
        if (this.port) {
            const port = this.port;
            this.port = null;
            try {
                if (port.isOpen) port.close(() => {});
            } catch (_) {
                // Closing an already-closing port is the desired end state.
            }
        }
        this.open = false;
    }

    _reportProblem(key, message) {
        if (this._lastReportedProblem === key) {
            logger.debug(message);
            return;
        }
        this._lastReportedProblem = key;
        logger.warn(message);
    }

    _scheduleRetry() {
        if (this.stopped || this.retryTimer) return;
        const delay = this.backoffMs;
        this.backoffMs = Math.min(this.backoffMs * 2, this.config.reconnectMaxMs);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this._openWhenAvailable();
        }, delay);
    }

    async _openWhenAvailable() {
        if (this.stopped) return;

        let ports;
        try {
            ports = await listSystemPorts();
        } catch (err) {
            this._reportProblem("list", `Could not enumerate serial ports: ${err.message}`);
            this._scheduleRetry();
            return;
        }

        const resolved = resolvePort({ configuredPath: this.config.serialPort, ports });
        if (!resolved.ok) {
            this._reportProblem(resolved.code, `${resolved.message} Retrying...`);
            this.emit("unavailable", resolved);
            this._scheduleRetry();
            return;
        }

        this._openPort(resolved);
    }

    _openPort(resolved) {
        // Required lazily so the pure logic in this package (and its tests) can
        // be loaded without the native serialport binding present.
        const { SerialPort } = require("serialport");
        const { ReadlineParser } = require("@serialport/parser-readline");

        logger.info(`Found ESP32 on ${resolved.path} (${resolved.reason})`);
        if (resolved.port?.chip) {
            logger.info(`USB-serial chip: ${resolved.port.chip}`);
        }
        logger.info(`Opening ${resolved.path} at ${this.config.serialBaud} baud`);

        const port = new SerialPort(
            {
                path: resolved.path,
                baudRate: this.config.serialBaud,
                autoOpen: false,
            },
        );

        this.port = port;
        this.path = resolved.path;
        this.portInfo = resolved.port;

        // \n only: the firmware terminates every frame with a bare newline, and
        // a stray \r left by a CRLF-emitting sketch is stripped by the parser.
        const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

        parser.on("data", (line) => {
            this.linesSeen += 1;
            const message = parseSerialLine(line);

            if (message.type === "unparsed") {
                this.linesUnparsed += 1;

                // Raw ADC output is the one "unparsed" case that is a
                // misconfiguration rather than noise, and it is silent from the
                // operator's point of view: the board looks alive, the port
                // opens, and yet no weight ever reaches the backend. Said out
                // loud, once, with the fix — everything else stays at debug so
                // boot banners don't bury it.
                if (/raw ADC counts/.test(message.reason) && !this._rawAdcWarned) {
                    this._rawAdcWarned = true;
                    logger.warn(
                        "This board is printing RAW ADC COUNTS, not grams " +
                        `(e.g. ${String(line).trim().slice(0, 40)}). It is running a stock HX711 ` +
                        "calibration sketch, so: the numbers are not weights, the cell is not " +
                        "calibrated, the sample rate is too slow for the backend's stability rule, " +
                        "and the board reports no device UID.",
                    );
                    logger.warn(
                        "Nothing will be forwarded. Flash iot-device/esp32_pds.ino (Arduino IDE), " +
                        "then calibrate per iot-device/README_USB_SERIAL.md. Raw counts are " +
                        "deliberately never treated as grams.",
                    );
                    return;
                }

                // Boot banners, ROM chatter and half-written frames all land
                // here. Debug-level because they are expected, not errors.
                logger.debug(`Ignored serial line (${message.reason}): ${String(line).trim().slice(0, 120)}`);
                return;
            }

            this.emit("message", message);
        });

        port.open((err) => {
            if (err) {
                this.open = false;
                this.lastError = err.message;

                if (/access denied|resource busy|cannot open/i.test(err.message)) {
                    this._reportProblem(
                        "busy",
                        `${resolved.path} is held by another program — almost always the Arduino IDE's ` +
                        "Serial Monitor (or a Serial Plotter / another bridge instance). Close it and " +
                        "the bridge will take the port over automatically. Retrying...",
                    );
                } else if (/no such file|not exist|ENOENT/i.test(err.message)) {
                    this._reportProblem(
                        "gone",
                        `${resolved.path} disappeared before it could be opened — the board was probably ` +
                        "unplugged. Retrying...",
                    );
                } else {
                    this._reportProblem("open", `Failed to open ${resolved.path}: ${err.message}. Retrying...`);
                }

                this.port = null;
                this._scheduleRetry();
                return;
            }

            this.open = true;
            this.lastError = null;
            this.backoffMs = this.config.reconnectInitialMs;
            this._lastReportedProblem = null;
            logger.info(`Serial port ${resolved.path} open`);
            this.emit("open", { path: resolved.path, baud: this.config.serialBaud, port: this.portInfo });

            // Asks the board to re-announce itself. Matters when the bridge
            // attaches to a board that booted minutes ago: its `hello` frame is
            // long gone from the buffer, and without this the bridge would have
            // no device UID to authenticate with until the next reboot.
            port.write("id\n", (writeErr) => {
                if (writeErr) {
                    logger.debug(`Could not request device identity: ${writeErr.message}`);
                }
            });
        });

        port.on("error", (err) => {
            // A USB device yanked mid-stream surfaces here rather than as a
            // clean close. Logged and handled — never allowed to reach an
            // unhandled 'error' event, which would take the process down and
            // end the demo.
            this.lastError = err.message;
            logger.warn(`Serial error on ${this.path}: ${err.message}`);
        });

        port.on("close", (err) => {
            const wasOpen = this.open;
            this.open = false;
            this.port = null;

            if (wasOpen) {
                logger.warn(
                    `Serial port ${this.path} closed${err ? ` (${err.message})` : ""} — ` +
                    "ESP32 unplugged, reset, or the port was taken by another program.",
                );
                this.emit("closed", { path: this.path });
            }

            this._scheduleRetry();
        });
    }

    /** Sends a raw command line to the board (`t`, `c1000`, `id`). */
    write(line) {
        if (!this.port || !this.open) return false;
        try {
            this.port.write(`${line}\n`);
            return true;
        } catch (err) {
            logger.warn(`Could not write "${line}" to the device: ${err.message}`);
            return false;
        }
    }

    describe() {
        return {
            open: this.open,
            path: this.path,
            baud: this.config.serialBaud,
            chip: this.portInfo?.chip || null,
            configuredPort: this.config.serialPort || null,
            lastError: this.lastError,
            linesSeen: this.linesSeen,
            linesUnparsed: this.linesUnparsed,
        };
    }
}

module.exports = { SerialSource };
