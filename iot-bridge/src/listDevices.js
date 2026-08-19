#!/usr/bin/env node
/**
 * listDevices.js — `npm run iot:devices`
 *
 * Lists every serial port Windows can see, marks the ones that look like an
 * ESP32, and says what to put in iot-bridge/.env.
 *
 * This exists because COM numbering is not stable. Rather than telling the
 * operator to "check Device Manager", the same discovery logic the bridge uses
 * at runtime (portDiscovery.js) is exposed as a command, so what this prints and
 * what the bridge decides can never disagree.
 */

const { config } = require("./config");
const { describePorts, resolvePort, listSystemPorts, KNOWN_USB_SERIAL_VENDORS } = require("./portDiscovery");

const pad = (value, width) => String(value ?? "").padEnd(width);

const main = async () => {
    console.log("");
    console.log("PDS IoT — serial device discovery");
    console.log("=================================");
    console.log("");

    let ports;
    try {
        ports = await listSystemPorts();
    } catch (err) {
        console.error(`Could not enumerate serial ports: ${err.message}`);
        console.error("");
        console.error("On Windows this usually means the serialport native module did not build.");
        console.error("Run `npm install` inside iot-bridge/ and try again.");
        process.exitCode = 1;
        return;
    }

    const described = describePorts(ports);

    if (described.length === 0) {
        console.log("No serial ports found.");
        console.log("");
        console.log("Checklist:");
        console.log("  1. Is the ESP32 plugged into USB?");
        console.log("  2. Is it a DATA cable, not a charge-only one?");
        console.log("  3. Is the USB-UART driver installed? One of:");
        Object.values(KNOWN_USB_SERIAL_VENDORS).forEach((chip) => console.log(`       - ${chip}`));
        console.log("  4. Does the board appear under Ports (COM & LPT) in Device Manager?");
        return;
    }

    console.log(`${pad("PORT", 10)}${pad("LIKELY ESP32", 14)}${pad("VID:PID", 12)}DESCRIPTION`);
    console.log("-".repeat(78));
    for (const port of described) {
        const vidPid = port.vendorId ? `${port.vendorId}:${port.productId || "----"}` : "-";
        const description = port.chip || port.friendlyName || port.manufacturer || "(unknown device)";
        console.log(`${pad(port.path, 10)}${pad(port.isLikelyEsp32 ? "yes" : "no", 14)}${pad(vidPid, 12)}${description}`);
        if (port.serialNumber) {
            console.log(`${" ".repeat(36)}serial: ${port.serialNumber}`);
        }
    }
    console.log("");

    const resolved = resolvePort({ configuredPath: config.serialPort, ports });

    if (resolved.ok) {
        console.log(`The bridge would use: ${resolved.path}  (${resolved.reason})`);
        console.log("");
        if (!config.serialPort) {
            console.log("Nothing to configure — auto-detection found exactly one candidate.");
            console.log(`Pin it only if you want to be explicit:  IOT_SERIAL_PORT=${resolved.path}`);
        }
    } else {
        console.log(`The bridge could NOT pick a port (${resolved.code}):`);
        console.log(`  ${resolved.message}`);
        console.log("");
        const candidates = resolved.candidates.filter((p) => p.isLikelyEsp32);
        if (candidates.length > 0) {
            console.log("Add one of these to iot-bridge/.env:");
            candidates.forEach((port) => console.log(`  IOT_SERIAL_PORT=${port.path}`));
        }
        process.exitCode = 1;
    }

    console.log("");
    console.log("Device identity is NOT the COM port. The board reports its own stable UID");
    console.log("(ESP32-XXXXXX, derived from its factory MAC) in the hello frame — that is what");
    console.log("gets registered in the Admin Panel and assigned to a shop.");
    console.log("");
    console.log("Note: while the Arduino IDE's Serial Monitor has a port open, the bridge cannot");
    console.log("use it. Close the Serial Monitor before starting `npm run iot:bridge`.");
    console.log("");
};

if (require.main === module) {
    main();
}

module.exports = { main };
