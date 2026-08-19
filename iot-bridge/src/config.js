const path = require("path");
const dotenv = require("dotenv");

// iot-bridge/.env holds the bridge's own settings (COM port, baud, device
// token). pds-backend/.env is ALSO loaded, second, purely to pick up PORT so
// IOT_BACKEND_URL doesn't have to be restated when someone changes the
// backend's port. dotenv never overwrites an already-set key, so the bridge's
// own file always wins.
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../pds-backend/.env") });

const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback) => {
    if (value === undefined || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

// The load cell's rated capacity, mirroring MAX_VALID_GRAMS in
// pds-backend/src/config/iot.js and PDS_LOAD_CELL_RATED_GRAMS in
// iot-device/pds_config.h. Used ONLY for the bridge's log line and health
// output — the bridge does not silently drop readings above it. See
// serialParser.js's note on why out-of-range readings are forwarded rather
// than swallowed.
const HARDWARE_MAX_GRAMS = 5000;

const config = {
    // ---- SERIAL ----------------------------------------------------------
    // Leave IOT_SERIAL_PORT unset to auto-detect. Windows renumbers COM ports
    // when a board moves to a different USB socket, so a hardcoded value is a
    // liability; pin it only when several USB-serial adapters are attached and
    // auto-detection is ambiguous.
    serialPort: process.env.IOT_SERIAL_PORT || null,
    serialBaud: num(process.env.IOT_SERIAL_BAUD, 115200),

    // ---- BACKEND ---------------------------------------------------------
    // http:// URL of pds-backend. Converted to ws:// internally — the bridge
    // speaks the SAME device protocol the Wi-Fi firmware already spoke
    // (/ws/iot?deviceId=..., bearer token in Sec-WebSocket-Protocol), so no
    // second authentication mechanism or endpoint was introduced for USB.
    backendUrl: process.env.IOT_BACKEND_URL || `http://localhost:${process.env.PORT || 5055}`,
    backendWsPath: "/ws/iot",

    // ---- DEVICE IDENTITY / CREDENTIAL ------------------------------------
    // Normally left unset: the bridge uses the UID the board reports in its
    // serial `hello` frame (ESP32-XXXXXX, derived from the chip's eFuse MAC),
    // so the identity comes from the hardware rather than from a config file
    // that could disagree with it. Set it only to pin a specific device — the
    // bridge then refuses to connect if the attached board reports a different
    // UID, which is what stops a swapped board from inheriting this device's
    // shop and token.
    deviceId: process.env.IOT_DEVICE_ID || null,

    // The bearer token issued once by POST /api/admin/iot/devices. This is the
    // ONLY credential in the whole USB path, and it lives here rather than on
    // the board: firmware secrets end up in every Serial Monitor session and
    // every copied sketch. Never logged, never sent to the health endpoint.
    deviceToken: process.env.IOT_DEVICE_TOKEN || null,

    // ---- TIMING ----------------------------------------------------------
    // Reconnect backoff, applied to both the serial port and the backend
    // socket. Capped so an unplugged ESP32 or a stopped backend is picked up
    // within ~30 s of coming back, without hammering either in between.
    reconnectInitialMs: num(process.env.IOT_RECONNECT_INITIAL_MS, 1000),
    reconnectMaxMs: num(process.env.IOT_RECONNECT_MAX_MS, 30000),

    // Must stay under the backend's DEVICE_IDLE_TIMEOUT_MS (45 s,
    // pds-backend/src/config/iot.js): 15 s means the backend's stale sweep
    // needs three consecutive misses before terminating the socket.
    heartbeatMs: num(process.env.IOT_HEARTBEAT_MS, 15000),

    // ---- LOCAL HEALTH ----------------------------------------------------
    // Bound to loopback only. This is a local diagnostic for the operator
    // running the demo, not a service — nothing in the PDS system consumes it,
    // and it must not become reachable from the network.
    healthPort: num(process.env.IOT_BRIDGE_HEALTH_PORT, 5099),
    healthHost: "127.0.0.1",

    // ---- DEV/DEMO --------------------------------------------------------
    // Runs the whole bridge -> backend path with a synthetic reading source and
    // no serial port at all. Exists so the backend/admin/shopkeeper wiring can
    // be exercised when the hardware is not plugged in; it is NOT a substitute
    // for the physical test, and every log line it produces says SIMULATED.
    simulate: bool(process.env.IOT_SIMULATE, false),
    simulateTargetGrams: num(process.env.IOT_SIMULATE_TARGET_GRAMS, 0),

    HARDWARE_MAX_GRAMS,
};

// Validates the settings the bridge cannot run without. Returns a list of
// human-readable problems rather than throwing, so index.js can print all of
// them at once instead of making the operator fix them one restart at a time.
const validate = (cfg = config) => {
    const problems = [];

    if (!cfg.deviceToken) {
        problems.push(
            "IOT_DEVICE_TOKEN is not set. Register the device in the Admin Panel " +
            "(Settings > Devices > Register Device) and paste the token it shows once " +
            "into iot-bridge/.env.",
        );
    }

    if (!cfg.backendUrl.startsWith("http://") && !cfg.backendUrl.startsWith("https://")) {
        problems.push(`IOT_BACKEND_URL must start with http:// or https:// (got "${cfg.backendUrl}")`);
    }

    if (!Number.isFinite(cfg.serialBaud) || cfg.serialBaud <= 0) {
        problems.push(`IOT_SERIAL_BAUD must be a positive number (got "${cfg.serialBaud}")`);
    }

    if (cfg.heartbeatMs >= 45000) {
        problems.push(
            `IOT_HEARTBEAT_MS (${cfg.heartbeatMs}) must stay below the backend's 45 s idle timeout, ` +
            "or the backend will terminate the connection between heartbeats.",
        );
    }

    return problems;
};

// http(s):// -> ws(s)://, plus the device path and deviceId query parameter.
// The token is NOT put in the URL: URLs end up in logs and process lists, and
// the backend reads the credential from Sec-WebSocket-Protocol instead.
const buildWsUrl = (deviceId, cfg = config) =>
    `${cfg.backendUrl.replace(/\/+$/, "").replace(/^http/, "ws")}${cfg.backendWsPath}` +
    `?deviceId=${encodeURIComponent(deviceId)}`;

module.exports = { config, validate, buildWsUrl, HARDWARE_MAX_GRAMS };
