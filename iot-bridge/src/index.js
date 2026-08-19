#!/usr/bin/env node
/**
 * index.js — `npm run iot:bridge`
 *
 * The one process that owns the ESP32's COM port and relays weight readings to
 * pds-backend's existing /ws/iot device protocol.
 *
 *   ESP32 -> HX711 -> USB serial -> THIS PROCESS -> pds-backend -> PostgreSQL
 *
 * Startup sequence, in order, with a log line for each so a failure is
 * attributable at a glance:
 *   1. validate configuration
 *   2. scan serial ports / open the ESP32's port
 *   3. learn the device UID from the board's hello frame
 *   4. connect to the backend and authenticate the device
 *   5. forward readings
 */

const { config, validate } = require("./config");
const logger = require("./logger");
const { Bridge } = require("./bridge");
const { BackendClient } = require("./backendClient");
const { SerialSource } = require("./serialSource");
const { SimulatedSource } = require("./simulatedSource");
const { startHealthServer } = require("./healthServer");

const main = () => {
    logger.registerSecret(config.deviceToken);

    logger.info("PDS IoT bridge starting (ESP32 -> USB serial -> PDS backend)");

    const problems = validate(config);
    if (problems.length > 0) {
        // All problems at once — making the operator discover them one restart
        // at a time is the difference between a 30-second fix and a 5-minute one.
        logger.error("Cannot start. Fix the following in iot-bridge/.env:");
        problems.forEach((problem, index) => logger.error(`  ${index + 1}. ${problem}`));
        process.exitCode = 1;
        return;
    }

    logger.info(`Backend: ${config.backendUrl}${config.backendWsPath}`);
    logger.info(
        config.serialPort
            ? `Serial port: ${config.serialPort} (pinned via IOT_SERIAL_PORT) @ ${config.serialBaud} baud`
            : `Serial port: auto-detect @ ${config.serialBaud} baud (run \`npm run iot:devices\` to list ports)`,
    );

    const source = config.simulate ? new SimulatedSource(config) : new SerialSource(config);
    const client = new BackendClient(config);
    const bridge = new Bridge({ config, source, client });

    const healthServer = startHealthServer(bridge, config);

    client.on("open", () => {
        const snapshot = bridge.describe();
        logger.info(`Status: ONLINE  (device ${snapshot.bridge.deviceId})`);
        logger.info("Place grain on the scale — readings are now flowing to the PDS backend.");
    });

    client.on("close", () => {
        logger.info("Status: OFFLINE (backend connection lost)");
    });

    // Periodic one-line status so a long-running demo shows life without the
    // 10 Hz reading stream flooding the terminal.
    const statusTimer = setInterval(() => {
        const snapshot = bridge.describe();
        logger.info(
            `Status: ${snapshot.bridge.status.toUpperCase()} | ` +
            `weight: ${snapshot.reading.lastGrams === null ? "--" : `${snapshot.reading.lastGrams} g`} | ` +
            `forwarded: ${snapshot.backend.readingsForwarded} | ` +
            `serial: ${snapshot.serial.open ? snapshot.serial.path : "down"}`,
        );
    }, 30000);
    statusTimer.unref?.();

    bridge.start();

    let shuttingDown = false;
    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.info(`Received ${signal} — releasing the COM port and closing the backend connection.`);
        clearInterval(statusTimer);
        bridge.stop();
        healthServer.close();

        // Releasing the port matters: leaving it held would keep the Arduino
        // IDE from uploading or opening its Serial Monitor afterwards.
        setTimeout(() => process.exit(0), 300).unref?.();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // A relay must not die on an unexpected throw mid-demo. Logged loudly and
    // the process keeps running: the serial and backend layers both have their
    // own reconnect logic, and neither can leave a wallet half-debited (only the
    // backend writes business rows, and only inside a database transaction).
    process.on("uncaughtException", (err) => {
        logger.error(`Unexpected error (bridge continues): ${err.stack || err.message}`);
    });
    process.on("unhandledRejection", (reason) => {
        logger.error(`Unhandled promise rejection (bridge continues): ${reason}`);
    });
};

if (require.main === module) {
    main();
}

module.exports = { main };
