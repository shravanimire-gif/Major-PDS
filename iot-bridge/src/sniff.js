#!/usr/bin/env node
/**
 * sniff.js — `npm run sniff`
 *
 * Opens the ESP32's port read-only, dumps every raw line for a few seconds, and
 * shows how the bridge's parser interprets each one.
 *
 * This exists because the protocol question has to be answered by the hardware,
 * not assumed: a board may be running the PDS firmware (newline-delimited JSON),
 * a bare HX711 sketch (`1234` or `WEIGHT:1234`), or something else entirely. Run
 * this before the bridge to see exactly what is on the wire, and whether the
 * parser already understands it.
 *
 *   node src/sniff.js            # auto-detect, 8 seconds
 *   node src/sniff.js COM3 15    # explicit port, 15 seconds
 */

const { config } = require("./config");
const { resolvePort, listSystemPorts } = require("./portDiscovery");
const { parseSerialLine } = require("./serialParser");

const main = async () => {
    const portArg = process.argv[2] || config.serialPort;
    const seconds = Number(process.argv[3]) || 8;

    const ports = await listSystemPorts();
    const resolved = resolvePort({ configuredPath: portArg, ports });
    if (!resolved.ok) {
        console.error(`\nCannot open a port: ${resolved.message}\n`);
        process.exitCode = 1;
        return;
    }

    const { SerialPort } = require("serialport");
    const { ReadlineParser } = require("@serialport/parser-readline");

    console.log(`\nSniffing ${resolved.path} @ ${config.serialBaud} baud for ${seconds}s (${resolved.reason})`);
    console.log("Close the Arduino Serial Monitor first — Windows gives the port to one process.\n");

    const port = new SerialPort({ path: resolved.path, baudRate: config.serialBaud, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    const seen = [];
    const kinds = new Map();

    parser.on("data", (line) => {
        const raw = String(line).replace(/\r$/, "");
        const parsed = parseSerialLine(raw);
        kinds.set(parsed.type, (kinds.get(parsed.type) || 0) + 1);
        seen.push({ raw, parsed });

        // First 40 lines in full, then only a running count — a 10 Hz stream
        // would otherwise scroll the interesting boot lines away instantly.
        if (seen.length <= 40) {
            const summary =
                parsed.type === "reading"
                    ? `reading ${parsed.grams} g${parsed.deviceTs === null ? "" : ` (ts ${parsed.deviceTs})`}`
                    : parsed.type === "unparsed"
                      ? `IGNORED (${parsed.reason})`
                      : parsed.type;
            console.log(`  ${String(seen.length).padStart(3)} | ${JSON.stringify(raw).slice(0, 90).padEnd(92)} -> ${summary}`);
        }
    });

    port.on("error", (err) => {
        console.error(`\nSerial error: ${err.message}`);
        if (/access denied|resource busy/i.test(err.message)) {
            console.error("The Arduino IDE's Serial Monitor almost certainly has this port open. Close it.");
        }
    });

    await new Promise((resolve, reject) => {
        port.open((err) => (err ? reject(err) : resolve()));
    }).catch((err) => {
        console.error(`\nCould not open ${resolved.path}: ${err.message}`);
        if (/access denied|resource busy/i.test(err.message)) {
            console.error("Close the Arduino IDE's Serial Monitor and run this again.");
        }
        process.exit(1);
    });

    // Ask for an identity frame. Harmless to a sketch that does not understand
    // it (the PDS firmware answers with `hello`; anything else ignores the byte).
    port.write("id\n", () => {});

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

    port.close(() => {});

    console.log(`\n--- SUMMARY (${seen.length} lines in ${seconds}s) ---`);
    if (seen.length === 0) {
        console.log("  Nothing received. Either the board is not transmitting, the baud rate is wrong,");
        console.log("  or the sketch only prints on request. Try the Arduino Serial Monitor at 115200.");
    }
    for (const [kind, count] of [...kinds.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(count).padStart(5)}  ${kind}`);
    }

    const readings = seen.filter((s) => s.parsed.type === "reading").map((s) => s.parsed.grams);
    if (readings.length) {
        const min = Math.min(...readings);
        const max = Math.max(...readings);
        console.log(`\n  Parsed weights: ${readings.length} readings, ${min} g .. ${max} g (spread ${max - min} g)`);
        console.log(`  Rate: ${(readings.length / seconds).toFixed(1)} readings/s`);
    }

    const hello = seen.find((s) => s.parsed.type === "hello");
    if (hello) {
        console.log(`\n  Device UID:  ${hello.parsed.deviceId}`);
        console.log(`  Firmware:    ${hello.parsed.firmware}`);
        console.log(`  Calibrated:  ${hello.parsed.calibrated}`);
    } else {
        console.log("\n  No `hello` frame — this board is NOT running the PDS serial firmware.");
        console.log("  The bridge can still read its weights, but it has no device UID to");
        console.log("  authenticate with, so IOT_DEVICE_ID must be set explicitly (or flash");
        console.log("  iot-device/esp32_pds.ino to get a MAC-derived UID).");
    }

    const ignored = seen.filter((s) => s.parsed.type === "unparsed");
    if (ignored.length) {
        console.log(`\n  ${ignored.length} ignored line(s); distinct examples:`);
        const examples = new Map();
        for (const item of ignored) {
            if (!examples.has(item.parsed.reason)) examples.set(item.parsed.reason, item.raw);
        }
        for (const [reason, raw] of examples) {
            console.log(`    ${reason}: ${JSON.stringify(raw).slice(0, 80)}`);
        }
    }
    console.log("");
};

if (require.main === module) {
    main();
}
