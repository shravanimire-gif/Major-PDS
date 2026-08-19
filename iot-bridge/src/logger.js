/**
 * logger.js
 *
 * Deliberately console-only. This process is watched by a human in a terminal
 * during a demo, so its output is a running commentary, not a log stream to be
 * shipped anywhere — and pulling winston in (as pds-backend does, where logs
 * genuinely are persisted and queried) would add a dependency for no consumer.
 *
 * SECRET HYGIENE
 * `redact()` is applied to every line. The device token is the one credential
 * in the USB path, and a bridge that printed it once — in a URL, an error
 * message, a config dump — would leak it into terminal scrollback, screen
 * recordings and pasted bug reports.
 */

const SECRETS = new Set();

// Registers a value that must never appear in output. Called once at startup
// with the device token.
const registerSecret = (value) => {
    if (typeof value === "string" && value.length >= 8) {
        SECRETS.add(value);
    }
};

const redact = (text) => {
    let out = String(text);
    for (const secret of SECRETS) {
        out = out.split(secret).join("***redacted***");
    }
    return out;
};

const stamp = () => new Date().toISOString().slice(11, 19);

const emit = (stream, level, message) => {
    stream(`[${stamp()}] [IoT]${level ? ` ${level}` : ""} ${redact(message)}`);
};

const logger = {
    registerSecret,
    redact,
    info: (message) => emit(console.log, "", message),
    warn: (message) => emit(console.warn, "WARN", message),
    error: (message) => emit(console.error, "ERROR", message),

    // Off unless IOT_BRIDGE_DEBUG is set. Per-reading and per-unparsed-line
    // detail at 10 Hz would bury the lines the operator actually needs.
    debug: (message) => {
        if (process.env.IOT_BRIDGE_DEBUG) {
            emit(console.log, "DEBUG", message);
        }
    },
};

module.exports = logger;
