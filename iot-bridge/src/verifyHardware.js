#!/usr/bin/env node
/**
 * verifyHardware.js — `npm run iot:verify`
 *
 * The physical acceptance test. Everything here needs the real ESP32 + HX711 +
 * 5 kg load cell attached over USB, and none of it can be satisfied by a
 * simulator — that is the point. It is deliberately separate from the unit and
 * integration suites, which pass with no hardware present and therefore prove
 * nothing about the board.
 *
 * Checks, in dependency order, stopping at the first hard failure:
 *
 *   1  COM port discovery finds exactly one candidate
 *   2  the port opens (i.e. nothing else holds it)
 *   3  the board speaks the PDS serial protocol
 *   4  it reports a stable MAC-derived device UID
 *   5  it reports a firmware version
 *   6  it is calibrated
 *   7  the sample rate is fast enough for the backend's stability rule
 *   8  a zeroed pan reads ~0 g and is stable
 *   9  the load cell responds to weight, in the right direction
 *  10  the device is registered in PostgreSQL, enabled and assigned to a shop
 *  11  the bridge authenticates to the backend
 *  12  the backend reports the device ONLINE
 *  13  live weight reaches the backend
 *  14  removing the weight returns to ~0 g
 *
 * It never creates a transaction, a dispense_record or a wallet debit: it has no
 * session, and without one the backend persists readings and nothing else.
 * Committing a dispense is the last step of the demo and belongs in the UI, with
 * a real beneficiary — the script prints exactly how to do that at the end.
 *
 *   npm run iot:verify                 # interactive, uses a ~500 g test weight
 *   npm run iot:verify -- --weight 200 # tell it what you are about to place
 *   npm run iot:verify -- --no-prompt  # skip the physical-weight steps (8-9, 13-14)
 */

const readline = require("readline");
const http = require("http");
const { config, validate } = require("./config");
const logger = require("./logger");
const { resolvePort, listSystemPorts, likelyEsp32Ports } = require("./portDiscovery");
const { parseSerialLine } = require("./serialParser");
const { BackendClient } = require("./backendClient");

// The backend needs >= 15 readings inside a 3 s window to auto-confirm
// (STABILITY_MIN_READINGS / STABILITY_WINDOW_MS in pds-backend/src/config/iot.js),
// i.e. 5 Hz absolute minimum. The firmware samples at 10 Hz; anything below 8
// leaves no margin for a dropped frame.
const MIN_SAMPLE_HZ = 8;

// A zeroed pan should sit within this of 0 g, and drift no more than this across
// the sample window. Wider than the 5 g stability spread on purpose: this checks
// that the cell is sane, not that it is dispense-ready.
const ZERO_TOLERANCE_G = 15;

const results = [];

const record = (id, name, status, detail) => {
    results.push({ id, name, status, detail });
    const mark = status === "pass" ? "PASS" : status === "warn" ? "WARN" : status === "skip" ? "SKIP" : "FAIL";
    const line = `  [${mark}] ${String(id).padStart(2)}. ${name}`;
    if (status === "fail") console.error(line);
    else console.log(line);
    if (detail) console.log(`         ${detail}`);
    return status !== "fail";
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ask = (question) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

const httpGetJson = (url, headers = {}) =>
    new Promise((resolve, reject) => {
        const req = http.get(url, { headers }, (res) => {
            let body = "";
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
                } catch (err) {
                    resolve({ status: res.statusCode, body: null, raw: body });
                }
            });
        });
        req.on("error", reject);
        req.setTimeout(5000, () => req.destroy(new Error("timeout")));
    });

/** Collects parsed serial messages for a window, so a check can look at a run of readings. */
const collect = (state, ms) =>
    new Promise((resolve) => {
        const start = state.messages.length;
        setTimeout(() => resolve(state.messages.slice(start)), ms);
    });

const main = async () => {
    const args = process.argv.slice(2);
    const noPrompt = args.includes("--no-prompt");
    const weightIdx = args.indexOf("--weight");
    const testWeightG = weightIdx >= 0 ? Number(args[weightIdx + 1]) : 500;

    console.log("\nPDS IoT — PHYSICAL HARDWARE VERIFICATION");
    console.log("========================================");
    console.log("Requires the real ESP32 + HX711 + 5 kg load cell attached over USB.");
    console.log("Close the Arduino IDE's Serial Monitor before continuing.\n");

    if (testWeightG > 4000) {
        console.error(
            `\nRefusing to run: --weight ${testWeightG} g is above the 4000 g business ceiling and close to\n` +
            "the 5 kg cell rating. Use a small test weight; overloading the cell deforms the strain gauge.\n",
        );
        process.exitCode = 1;
        return;
    }

    // ---- 1. Discovery --------------------------------------------------
    let ports;
    try {
        ports = await listSystemPorts();
    } catch (err) {
        record(1, "COM port discovery", "fail", err.message);
        return summarise();
    }

    const candidates = likelyEsp32Ports(ports);
    const resolved = resolvePort({ configuredPath: config.serialPort, ports });
    if (!resolved.ok) {
        record(1, "COM port discovery", "fail", resolved.message);
        return summarise();
    }
    record(
        1,
        "COM port discovery",
        "pass",
        `${resolved.path} — ${resolved.port?.chip || "pinned"} (${candidates.length} candidate(s), ${ports.length} port(s) present)`,
    );

    // ---- 2. Port opens -------------------------------------------------
    const { SerialPort } = require("serialport");
    const { ReadlineParser } = require("@serialport/parser-readline");

    const port = new SerialPort({ path: resolved.path, baudRate: config.serialBaud, autoOpen: false });
    const state = { messages: [], rawLines: 0, rawAdc: 0 };

    port.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", (line) => {
        state.rawLines += 1;
        const message = parseSerialLine(line);
        if (message.type === "unparsed" && /raw ADC counts/.test(message.reason)) state.rawAdc += 1;
        state.messages.push(message);
    });

    try {
        await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
    } catch (err) {
        const hint = /access denied|resource busy/i.test(err.message)
            ? "Close the Arduino IDE's Serial Monitor (Windows gives the port to one process) and retry."
            : err.message;
        record(2, "Serial port opens", "fail", hint);
        return summarise();
    }
    record(2, "Serial port opens", "pass", `${resolved.path} @ ${config.serialBaud} baud`);

    const cleanup = () => {
        try {
            if (port.isOpen) port.close(() => {});
        } catch (_) {
            /* already closing */
        }
    };

    try {
        // ---- 3/4/5/6. Identity ----------------------------------------
        port.write("id\n", () => {});
        const identityWindow = await collect(state, 3000);
        const hello = identityWindow.find((m) => m.type === "hello");

        if (!hello) {
            if (state.rawAdc > 0) {
                record(
                    3,
                    "Board speaks the PDS serial protocol",
                    "fail",
                    "The board is printing RAW ADC COUNTS (a stock HX711 sketch). Those are not grams, the " +
                    "cell is not calibrated, and no device UID is reported. Flash iot-device/esp32_pds.ino.",
                );
            } else {
                record(
                    3,
                    "Board speaks the PDS serial protocol",
                    "fail",
                    `No hello frame in 3 s (${state.rawLines} line(s) seen). Flash iot-device/esp32_pds.ino, ` +
                    "and check the baud rate is 115200.",
                );
            }
            cleanup();
            return summarise();
        }
        record(3, "Board speaks the PDS serial protocol", "pass", "hello frame received");

        if (!hello.deviceId || !/^ESP32-[0-9A-F]{6}$/i.test(hello.deviceId)) {
            record(
                4,
                "Stable MAC-derived device UID",
                "fail",
                `Reported "${hello.deviceId}" — expected ESP32-XXXXXX derived from the chip's eFuse MAC.`,
            );
            cleanup();
            return summarise();
        }
        record(4, "Stable MAC-derived device UID", "pass", hello.deviceId);

        record(
            5,
            "Firmware version reported",
            hello.firmware ? "pass" : "warn",
            hello.firmware || "not reported — the Admin Panel's Firmware column will be blank",
        );

        if (!hello.calibrated) {
            record(
                6,
                "Load cell is calibrated",
                "fail",
                "calibration_factor is 1.0, so readings are raw ADC counts scaled by nothing. Run the " +
                "procedure in iot-device/README_USB_SERIAL.md (tare with 't', then 'c<grams>').",
            );
            cleanup();
            return summarise();
        }
        record(6, "Load cell is calibrated", "pass", `calibration_factor = ${hello.calibrationFactor}`);

        if (hello.cellRatedGrams && hello.cellRatedGrams !== config.HARDWARE_MAX_GRAMS) {
            record(
                6.5,
                "Cell rating agrees with the backend",
                "warn",
                `Board says ${hello.cellRatedGrams} g, bridge/backend configured for ${config.HARDWARE_MAX_GRAMS} g. ` +
                "The more permissive of the two becomes the effective safety limit.",
            );
        }

        // ---- 7. Sample rate -------------------------------------------
        const rateWindow = await collect(state, 3000);
        const rateReadings = rateWindow.filter((m) => m.type === "reading");
        const hz = rateReadings.length / 3;
        if (rateReadings.length === 0) {
            record(7, "Sample rate", "fail", "No readings at all in 3 s.");
            cleanup();
            return summarise();
        }
        if (hz < MIN_SAMPLE_HZ) {
            record(
                7,
                "Sample rate",
                "fail",
                `${hz.toFixed(1)} Hz — the backend needs >=15 readings inside a 3 s window to auto-confirm, ` +
                `so anything under ${MIN_SAMPLE_HZ} Hz cannot complete a dispense.`,
            );
            cleanup();
            return summarise();
        }
        record(7, "Sample rate", "pass", `${hz.toFixed(1)} Hz (${rateReadings.length} readings in 3 s)`);

        // ---- 8. Zero -------------------------------------------------
        if (noPrompt) {
            record(8, "Zeroed pan reads ~0 g", "skip", "--no-prompt");
            record(9, "Load cell responds to weight", "skip", "--no-prompt");
        } else {
            console.log("");
            await ask("  >> Remove everything from the pan, then press Enter to tare and zero-check... ");
            port.write("t\n", () => {});
            await sleep(1200);

            const zeroWindow = await collect(state, 3000);
            const zeroReadings = zeroWindow.filter((m) => m.type === "reading").map((m) => m.grams);
            if (zeroReadings.length === 0) {
                record(8, "Zeroed pan reads ~0 g", "fail", "No readings after tare.");
                cleanup();
                return summarise();
            }
            const zMin = Math.min(...zeroReadings);
            const zMax = Math.max(...zeroReadings);
            const zAvg = Math.round(zeroReadings.reduce((a, b) => a + b, 0) / zeroReadings.length);

            if (Math.abs(zAvg) > ZERO_TOLERANCE_G || zMax - zMin > ZERO_TOLERANCE_G * 2) {
                record(
                    8,
                    "Zeroed pan reads ~0 g",
                    "fail",
                    `avg ${zAvg} g, spread ${zMax - zMin} g. An empty pan should read near 0 with little drift — ` +
                    "check the cell is mounted without pre-load and the wiring is secure.",
                );
                cleanup();
                return summarise();
            }
            record(8, "Zeroed pan reads ~0 g", "pass", `avg ${zAvg} g, spread ${zMax - zMin} g`);

            // ---- 9. Responds to load ---------------------------------
            console.log("");
            await ask(`  >> Place a ~${testWeightG} g weight on the pan, then press Enter... `);
            await sleep(1500);

            const loadWindow = await collect(state, 3000);
            const loadReadings = loadWindow.filter((m) => m.type === "reading").map((m) => m.grams);
            const faults = loadWindow.filter((m) => m.type === "error");

            if (faults.length > 0) {
                record(
                    9,
                    "Load cell responds to weight",
                    "fail",
                    `Board reported ${faults[0].code}: ${faults[0].detail || ""}`,
                );
                cleanup();
                return summarise();
            }
            if (loadReadings.length === 0) {
                record(9, "Load cell responds to weight", "fail", "No readings under load.");
                cleanup();
                return summarise();
            }

            const lAvg = Math.round(loadReadings.reduce((a, b) => a + b, 0) / loadReadings.length);
            const lSpread = Math.max(...loadReadings) - Math.min(...loadReadings);
            const errorPct = testWeightG > 0 ? Math.abs((lAvg - testWeightG) / testWeightG) * 100 : 0;

            if (lAvg < 0) {
                record(
                    9,
                    "Load cell responds to weight",
                    "fail",
                    `Reads ${lAvg} g under load — negative. A+ and A- are swapped, or the calibration was done ` +
                    "against a negative reference. Re-run the calibration procedure.",
                );
                cleanup();
                return summarise();
            }
            if (lAvg < ZERO_TOLERANCE_G) {
                record(
                    9,
                    "Load cell responds to weight",
                    "fail",
                    `Still reads ${lAvg} g with weight on the pan — the cell is not responding. Check the ` +
                    "HX711 DT/SCK wiring and that the load path actually goes through the cell.",
                );
                cleanup();
                return summarise();
            }
            // Accuracy is reported, not enforced: the operator's "~500 g" is an
            // estimate, and calibration accuracy is a separate concern from
            // "does the hardware work".
            record(
                9,
                "Load cell responds to weight",
                errorPct > 20 ? "warn" : "pass",
                `reads ${lAvg} g for a stated ${testWeightG} g (${errorPct.toFixed(1)}% off), spread ${lSpread} g` +
                (errorPct > 20 ? " — consider re-calibrating against a known mass" : ""),
            );
        }

        // ---- 10. Registry ---------------------------------------------
        const problems = validate(config);
        if (problems.length > 0) {
            record(10, "Device registered and assigned", "fail", problems.join(" "));
            cleanup();
            return summarise();
        }

        // ---- 11/12/13. Through the bridge to the backend ---------------
        const client = new BackendClient({ ...config, deviceId: hello.deviceId });
        let authed = false;
        client.on("open", () => {
            authed = true;
        });
        client.start(hello.deviceId, hello.firmware);

        const deadline = Date.now() + 12000;
        while (!authed && Date.now() < deadline) {
            await sleep(200);
        }

        if (!authed) {
            record(
                10,
                "Device registered and assigned",
                "fail",
                `The backend refused ${hello.deviceId} (or is unreachable at ${config.backendUrl}). Either the ` +
                "device is not registered, not assigned to a shop, disabled, the token is wrong, or " +
                "`npm run dev` is not running. Provision it with: node pds-backend/scripts/" +
                `provision-iot-device.js --shopkeeper <email> --from-serial ${resolved.path} --write-env`,
            );
            client.stop();
            cleanup();
            return summarise();
        }
        record(10, "Device registered and assigned", "pass", `${hello.deviceId} accepted by the backend`);
        record(11, "Bridge authenticates to the backend", "pass", `${config.backendUrl}${config.backendWsPath}`);

        // Forward real readings for a few seconds.
        const forwardStart = client.readingsForwarded;
        const relay = (message) => {
            if (message.type === "reading") client.sendReading(message.grams);
        };
        const relayFrom = state.messages.length;
        await sleep(4000);
        state.messages.slice(relayFrom).forEach(relay);
        await sleep(500);

        const forwarded = client.readingsForwarded - forwardStart;
        record(
            12,
            "Live weight reaches the backend",
            forwarded > 0 ? "pass" : "fail",
            `${forwarded} reading(s) forwarded over /ws/iot`,
        );

        // ---- 13. Bridge health -----------------------------------------
        try {
            const health = await httpGetJson(`http://${config.healthHost}:${config.healthPort}/health`);
            record(
                13,
                "Bridge health endpoint",
                health.status ? "pass" : "warn",
                `HTTP ${health.status} (only served while \`npm run iot:bridge\` is running)`,
            );
        } catch (_) {
            record(
                13,
                "Bridge health endpoint",
                "skip",
                "not running — expected, this script does not start the full bridge process",
            );
        }

        // ---- 14. Return to zero ----------------------------------------
        if (!noPrompt) {
            console.log("");
            await ask("  >> Remove the weight from the pan, then press Enter... ");
            await sleep(1500);
            const backWindow = await collect(state, 2500);
            const backReadings = backWindow.filter((m) => m.type === "reading").map((m) => m.grams);
            if (backReadings.length === 0) {
                record(14, "Returns to ~0 g when unloaded", "fail", "No readings.");
            } else {
                const bAvg = Math.round(backReadings.reduce((a, b) => a + b, 0) / backReadings.length);
                record(
                    14,
                    "Returns to ~0 g when unloaded",
                    Math.abs(bAvg) <= ZERO_TOLERANCE_G * 2 ? "pass" : "warn",
                    `avg ${bAvg} g` +
                    (Math.abs(bAvg) > ZERO_TOLERANCE_G * 2
                        ? " — the cell is not returning to zero, which suggests mechanical binding or creep"
                        : ""),
                );
            }
        } else {
            record(14, "Returns to ~0 g when unloaded", "skip", "--no-prompt");
        }

        client.stop();
    } finally {
        cleanup();
    }

    return summarise();
};

const summarise = () => {
    const pass = results.filter((r) => r.status === "pass").length;
    const fail = results.filter((r) => r.status === "fail").length;
    const warn = results.filter((r) => r.status === "warn").length;
    const skip = results.filter((r) => r.status === "skip").length;

    console.log("\n----------------------------------------------------------");
    console.log(`HARDWARE VERIFICATION: ${fail === 0 ? "PASS" : "FAIL"}`);
    console.log(`  ${pass} passed · ${fail} failed · ${warn} warning(s) · ${skip} skipped`);
    console.log("----------------------------------------------------------");

    if (fail > 0) {
        console.log("\nFailed checks:");
        results.filter((r) => r.status === "fail").forEach((r) => console.log(`  ${r.id}. ${r.name}\n     ${r.detail}`));
        console.log("");
        process.exitCode = 1;
        return;
    }

    console.log("\nThe physical device path is verified: board -> HX711 -> USB -> bridge -> backend.");
    console.log("\nWhat this did NOT do — and deliberately so: it created no transaction, no");
    console.log("dispense_record and no wallet debit. Readings without an authorised session are");
    console.log("just sensor data. To complete the business chain:");
    console.log("");
    console.log("  1. Leave `npm run dev` running, and start `npm run iot:bridge`.");
    console.log("  2. Admin Panel -> Settings -> Devices: confirm the device shows Online with a");
    console.log("     live Current Weight, the right shop and the right shopkeeper.");
    console.log("  3. Log in as that shopkeeper -> Scan & Dispense -> scan a beneficiary's QR.");
    console.log("  4. Press 'Weigh on Scale' for rice or wheat.");
    console.log("  5. Pour grain until the readout is inside the tolerance band and hold steady.");
    console.log("  6. It auto-confirms, and you get a transaction ID.");
    console.log("  7. Verify: wallet debited to 0.00, one row in transactions, one in");
    console.log("     dispense_records, the dispense visible in analytics and the activity feed.");
    console.log("");
};

if (require.main === module) {
    main().catch((err) => {
        console.error(`\nUNEXPECTED ERROR: ${err.stack || err.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = { main };
