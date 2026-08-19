#!/usr/bin/env node
/**
 * provision-iot-device.js
 *
 * Registers a physical ESP32 weighing device and assigns it to a shopkeeper's
 * shop, resolving every fact from PostgreSQL rather than assuming it.
 *
 *   node scripts/provision-iot-device.js --shopkeeper ajay.wankhede@pds.gov --device-id ESP32-A1B2C3
 *   node scripts/provision-iot-device.js --shopkeeper ajay.wankhede@pds.gov --from-serial COM3
 *   node scripts/provision-iot-device.js --shopkeeper ajay.wankhede@pds.gov --device-id ESP32-A1B2C3 --rotate
 *
 * NO EMAIL IS HARDCODED. The shopkeeper is a required argument and is looked up
 * in `users`; the shop comes from `shops.shopkeeper_id`. That is the whole point
 * of this script existing rather than a SQL snippet in a README: the
 * device -> shop -> shopkeeper chain is verified against the live database, and
 * it refuses to proceed rather than inventing any part of it.
 *
 * WHAT IT VERIFIES BEFORE WRITING ANYTHING
 *   1. the user exists
 *   2. the user's role is 'shopkeeper'
 *   3. the user is active
 *   4. exactly one shop names them as shopkeeper
 *   5. that shop is active
 *   6. the shop has no OTHER active device (one physical scale per shop)
 *   7. the device UID is not already registered to a different shop
 *
 * If any check fails it stops and explains which one. It never creates a user,
 * never creates a shop, and never touches a wallet, transaction or
 * dispense_record.
 *
 * --from-serial <PORT> reads the UID from the attached board instead of taking
 * it on the command line, by asking it for its `hello` frame. Preferred: a UID
 * typed by hand can be mistyped, and a device row whose UID does not match the
 * hardware is a device that can never authenticate.
 */

const path = require("path");
const fs = require("fs");
const pool = require("../src/config/db");
const { generateToken, hashToken } = require("../src/services/deviceRegistryService");
const { TOKEN_ROTATION_GRACE_MS } = require("../src/config/iot");

const BRIDGE_ENV_PATH = path.resolve(__dirname, "../../iot-bridge/.env");

const parseArgs = (argv) => {
    const args = {};
    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith("--")) continue;
        const key = token.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith("--")) {
            args[key] = true;
        } else {
            args[key] = next;
            i += 1;
        }
    }
    return args;
};

const die = (message, hint) => {
    console.error(`\nFAILED: ${message}`);
    if (hint) console.error(`\n${hint}`);
    console.error("");
    process.exitCode = 1;
};

const usage = () => {
    console.log(`
Usage:
  node scripts/provision-iot-device.js --shopkeeper <email> (--device-id <UID> | --from-serial <PORT>)
                                       [--device-name "<label>"] [--rotate] [--write-env]

  --shopkeeper    REQUIRED. Email of the shopkeeper whose shop gets the device.
                  Resolved from the users table; never hardcoded.
  --device-id     The board's stable UID, e.g. ESP32-A1B2C3.
  --from-serial   Read the UID from the attached board instead (e.g. COM3).
                  Requires the PDS serial firmware to be flashed.
  --device-name   Optional human label shown in the Admin Panel.
  --rotate        Issue a new token for an already-registered device.
  --write-env     Write IOT_DEVICE_TOKEN/IOT_DEVICE_ID into iot-bridge/.env.
`);
};

/**
 * Asks the attached board for its identity frame.
 *
 * Requires iot-bridge's node_modules for the serialport binding, which is where
 * the only serial dependency in the repo lives — the backend must stay runnable
 * on a machine with no hardware attached, so it never gets a serial dependency
 * of its own.
 */
const readDeviceIdFromSerial = async (portPath) => {
    const bridgeSrc = path.resolve(__dirname, "../../iot-bridge/src");
    let SerialPort;
    let ReadlineParser;
    let parseSerialLine;
    try {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        ({ SerialPort } = require(path.resolve(__dirname, "../../iot-bridge/node_modules/serialport")));
        // eslint-disable-next-line import/no-dynamic-require, global-require
        ({ ReadlineParser } = require(
            path.resolve(__dirname, "../../iot-bridge/node_modules/@serialport/parser-readline"),
        ));
        // eslint-disable-next-line import/no-dynamic-require, global-require
        ({ parseSerialLine } = require(path.join(bridgeSrc, "serialParser.js")));
    } catch (err) {
        throw new Error(
            `Could not load the serial libraries from iot-bridge (${err.message}). ` +
            "Run `npm install` inside iot-bridge/ first.",
        );
    }

    const baud = Number(process.env.IOT_SERIAL_BAUD) || 115200;
    console.log(`  Opening ${portPath} at ${baud} baud to ask the board for its UID...`);

    const port = new SerialPort({ path: portPath, baudRate: baud, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

    return new Promise((resolve, reject) => {
        let settled = false;
        const sawRawAdc = { value: false };

        const finish = (fn, arg) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                if (port.isOpen) port.close(() => {});
            } catch (_) {
                /* closing an already-closing port is fine */
            }
            fn(arg);
        };

        const timer = setTimeout(() => {
            finish(
                reject,
                new Error(
                    sawRawAdc.value
                        ? "The board is printing RAW ADC COUNTS, not PDS frames — it is still running a " +
                          "stock HX711 sketch and reports no UID. Flash iot-device/esp32_pds.ino, then retry."
                        : "The board did not send a `hello` frame within 10s. Either the PDS serial firmware " +
                          "is not flashed, the baud rate is wrong, or the Arduino Serial Monitor has the port.",
                ),
            );
        }, 10000);

        parser.on("data", (line) => {
            const message = parseSerialLine(line);
            if (message.type === "hello" && message.deviceId) {
                finish(resolve, {
                    deviceId: message.deviceId,
                    firmware: message.firmware,
                    calibrated: message.calibrated,
                    calibrationFactor: message.calibrationFactor,
                    cellRatedGrams: message.cellRatedGrams,
                });
            } else if (message.type === "unparsed" && /raw ADC counts/.test(message.reason)) {
                sawRawAdc.value = true;
            }
        });

        port.on("error", (err) => finish(reject, err));

        port.open((err) => {
            if (err) {
                const hint = /access denied|resource busy/i.test(err.message)
                    ? " — the Arduino IDE's Serial Monitor almost certainly has this port open. Close it."
                    : "";
                finish(reject, new Error(`Could not open ${portPath}: ${err.message}${hint}`));
                return;
            }
            // The board sends `hello` at boot; a board that booted minutes ago
            // needs to be asked.
            port.write("id\n", () => {});
        });
    });
};

const upsertEnvValue = (contents, key, value) => {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    return pattern.test(contents) ? contents.replace(pattern, line) : `${contents.replace(/\s*$/, "")}\n${line}\n`;
};

const main = async () => {
    const args = parseArgs(process.argv);

    if (args.help || args.h) {
        usage();
        return;
    }

    const shopkeeperEmail = typeof args.shopkeeper === "string" ? args.shopkeeper.trim() : null;
    if (!shopkeeperEmail) {
        usage();
        die("--shopkeeper <email> is required.");
        return;
    }

    console.log("\nPDS IoT device provisioning");
    console.log("===========================\n");

    // ---- 1. Resolve the device UID -------------------------------------
    let deviceId = typeof args["device-id"] === "string" ? args["device-id"].trim() : null;
    let boardInfo = null;

    if (args["from-serial"]) {
        const portPath = typeof args["from-serial"] === "string" ? args["from-serial"] : process.env.IOT_SERIAL_PORT;
        if (!portPath) {
            die("--from-serial needs a port (e.g. --from-serial COM3), or set IOT_SERIAL_PORT.");
            return;
        }
        console.log("Reading the device UID from the attached board");
        try {
            boardInfo = await readDeviceIdFromSerial(portPath);
        } catch (err) {
            die(err.message);
            return;
        }
        console.log(`  Device UID:  ${boardInfo.deviceId}`);
        console.log(`  Firmware:    ${boardInfo.firmware || "(not reported)"}`);
        console.log(`  Calibrated:  ${boardInfo.calibrated ? "yes" : "NO"}`);
        if (boardInfo.calibrationFactor !== null && boardInfo.calibrationFactor !== undefined) {
            console.log(`  Cal factor:  ${boardInfo.calibrationFactor}`);
        }

        if (deviceId && deviceId !== boardInfo.deviceId) {
            die(
                `--device-id was "${deviceId}" but the attached board reports "${boardInfo.deviceId}".`,
                "Registering a UID that does not match the hardware creates a device row that can never " +
                "authenticate. Drop --device-id and let the board speak for itself.",
            );
            return;
        }
        deviceId = boardInfo.deviceId;

        if (!boardInfo.calibrated) {
            console.log(
                "\n  WARNING: this board is NOT calibrated. Provisioning will continue (registration and\n" +
                "  calibration are independent), but its readings are raw ADC counts scaled by nothing\n" +
                "  until you run the procedure in iot-device/README_USB_SERIAL.md.",
            );
        }
        console.log("");
    }

    if (!deviceId) {
        die("Provide --device-id <UID>, or --from-serial <PORT> to read it from the board.");
        return;
    }

    if (!/^[A-Za-z0-9._-]{3,100}$/.test(deviceId)) {
        die(`"${deviceId}" is not a usable device UID (3-100 chars, letters/digits/._-).`);
        return;
    }
    if (/^COM\d+$/i.test(deviceId)) {
        die(
            `"${deviceId}" is a COM port, not a device identity.`,
            "Windows reassigns COM numbers when a board moves to another USB socket, so a port number " +
            "cannot identify hardware. Use the board's ESP32-XXXXXX UID (--from-serial reads it for you).",
        );
        return;
    }

    // ---- 2. Resolve the shopkeeper -------------------------------------
    console.log(`Resolving shopkeeper "${shopkeeperEmail}" from PostgreSQL`);

    const userRes = await pool.query(
        `SELECT id, name, email, role, is_active FROM users WHERE lower(email) = lower($1)`,
        [shopkeeperEmail],
    );

    if (userRes.rows.length === 0) {
        die(
            `No user with email "${shopkeeperEmail}" exists.`,
            "This script will NOT create one — a fabricated shopkeeper would produce a device assigned to " +
            "a shop nobody staffs, and every dispense it gated would be attributed to a user who does not " +
            "exist. Create the user through the Admin Panel first.",
        );
        return;
    }

    const user = userRes.rows[0];
    console.log(`  Found:   ${user.name || "(no name)"} <${user.email}>`);
    console.log(`  Role:    ${user.role}`);
    console.log(`  Active:  ${user.is_active}`);

    if (user.role !== "shopkeeper") {
        die(
            `"${shopkeeperEmail}" has role "${user.role}", not "shopkeeper".`,
            "A device is assigned to a SHOP, and only a shopkeeper's shop can serve a dispense.",
        );
        return;
    }
    if (!user.is_active) {
        die(`"${shopkeeperEmail}" is deactivated.`, "Reactivate the user before assigning a device to their shop.");
        return;
    }

    // ---- 3. Resolve their shop -----------------------------------------
    const shopRes = await pool.query(
        `SELECT id, shop_code, shop_name, is_active FROM shops WHERE shopkeeper_id = $1 ORDER BY shop_code`,
        [user.id],
    );

    if (shopRes.rows.length === 0) {
        die(
            `"${shopkeeperEmail}" is a shopkeeper but has no shop assigned.`,
            "Assign them a shop in the Admin Panel (Shops -> Assign shopkeeper) first. A device with no " +
            "shop cannot gate a dispense session.",
        );
        return;
    }
    if (shopRes.rows.length > 1) {
        die(
            `"${shopkeeperEmail}" is the shopkeeper for ${shopRes.rows.length} shops ` +
            `(${shopRes.rows.map((s) => s.shop_code).join(", ")}).`,
            "Which shop the physical scale sits in is a fact about the world that this script cannot " +
            "guess. Assign the device explicitly in the Admin Panel (Settings -> Devices).",
        );
        return;
    }

    const shop = shopRes.rows[0];
    console.log(`  Shop:    ${shop.shop_name} (${shop.shop_code})`);
    console.log(`  Active:  ${shop.is_active}`);

    if (!shop.is_active) {
        die(`Shop ${shop.shop_code} is not active.`, "Activate the shop before assigning a device to it.");
        return;
    }

    // ---- 4. One active device per shop ---------------------------------
    const existingOnShop = await pool.query(
        `SELECT device_id, status FROM iot_devices
      WHERE shop_id = $1 AND status = 'active' AND device_id <> $2`,
        [shop.id, deviceId],
    );
    if (existingOnShop.rows.length > 0) {
        die(
            `Shop ${shop.shop_code} already has an active device: ${existingOnShop.rows
                .map((d) => d.device_id)
                .join(", ")}.`,
            "attachSession picks the shop's active device with LIMIT 1, so a second one would make which " +
            "scale gates a session non-deterministic. Unassign or disable the old device first " +
            "(Admin Panel -> Settings -> Devices).",
        );
        return;
    }

    // ---- 5. Register or re-assign --------------------------------------
    const deviceRes = await pool.query(
        `SELECT device_id, shop_id, status, device_name, firmware_version FROM iot_devices WHERE device_id = $1`,
        [deviceId],
    );
    const existing = deviceRes.rows[0] || null;

    const deviceName =
        typeof args["device-name"] === "string" ? args["device-name"] : existing?.device_name || `${shop.shop_name} scale`;

    let rawToken = null;

    if (!existing) {
        console.log(`\nRegistering ${deviceId}`);
        rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);
        await pool.query(
            `INSERT INTO iot_devices (device_id, device_token_hash, shop_id, device_name, status)
       VALUES ($1,$2,$3,$4,'active')`,
            [deviceId, tokenHash, shop.id, deviceName],
        );
        console.log(`  Registered and assigned to ${shop.shop_name}`);
    } else {
        console.log(`\n${deviceId} is already registered`);
        console.log(`  Current shop:   ${existing.shop_id === shop.id ? `${shop.shop_name} (unchanged)` : existing.shop_id || "unassigned"}`);
        console.log(`  Current status: ${existing.status}`);

        // Refuse to move a device that is mid-dispense — the same guard the API
        // applies, repeated here because this script bypasses the API.
        const liveSession = await pool.query(
            `SELECT id, state FROM dispense_sessions
        WHERE device_id = $1 AND state IN ('active','attached','weighing','confirming') LIMIT 1`,
            [deviceId],
        );
        if (liveSession.rows.length > 0) {
            die(
                `${deviceId} is mid-dispense (session ${liveSession.rows[0].id} is ${liveSession.rows[0].state}).`,
                "Wait for it to finish or cancel it before changing its assignment.",
            );
            return;
        }

        await pool.query(
            `UPDATE iot_devices
          SET shop_id = $1, device_name = $2, status = 'active'
        WHERE device_id = $3`,
            [shop.id, deviceName, deviceId],
        );
        console.log(`  Assigned to ${shop.shop_name} and enabled`);

        if (args.rotate) {
            rawToken = generateToken();
            const tokenHash = await hashToken(rawToken);
            const graceExpiresAt = new Date(Date.now() + TOKEN_ROTATION_GRACE_MS);
            await pool.query(
                `UPDATE iot_devices
            SET previous_token_hash = device_token_hash,
                previous_token_expires_at = $1,
                device_token_hash = $2
          WHERE device_id = $3`,
                [graceExpiresAt, tokenHash, deviceId],
            );
            console.log("  Token rotated (the previous one keeps working for a short grace period)");
        }
    }

    // ---- 6. Audit ------------------------------------------------------
    // Actor is the script, not a user: nobody logged in, and attributing this to
    // a real admin's id would be a false record.
    await pool.query(
        `INSERT INTO iot_audit (actor_type, actor_id, action, target, meta_json)
     VALUES ('script', NULL, $1, $2, $3)`,
        [
            existing ? "provision_reassign_device" : "provision_register_device",
            deviceId,
            JSON.stringify({
                shopId: shop.id,
                shopCode: shop.shop_code,
                shopkeeperEmail: user.email,
                tokenIssued: Boolean(rawToken),
                firmwareReported: boardInfo?.firmware || null,
            }),
        ],
    );

    // ---- 7. Report -----------------------------------------------------
    console.log("\n----------------------------------------------------------");
    console.log("PROVISIONED");
    console.log("----------------------------------------------------------");
    console.log(`  Device UID:   ${deviceId}`);
    console.log(`  Device name:  ${deviceName}`);
    console.log(`  Shop:         ${shop.shop_name} (${shop.shop_code})`);
    console.log(`  Shop ID:      ${shop.id}`);
    console.log(`  Shopkeeper:   ${user.name || "(no name)"} <${user.email}>`);
    console.log(`  Status:       active`);

    if (rawToken) {
        console.log("\n  DEVICE TOKEN (shown once — only its bcrypt hash is stored):");
        console.log(`\n    ${rawToken}\n`);
        console.log("  Put it in iot-bridge/.env as IOT_DEVICE_TOKEN. It belongs on the PC running");
        console.log("  the bridge, NOT on the ESP32 — a secret in firmware is a secret in every");
        console.log("  Serial Monitor session.");

        if (args["write-env"]) {
            let contents = "";
            if (fs.existsSync(BRIDGE_ENV_PATH)) {
                contents = fs.readFileSync(BRIDGE_ENV_PATH, "utf8");
            } else if (fs.existsSync(`${BRIDGE_ENV_PATH}.example`)) {
                contents = fs.readFileSync(`${BRIDGE_ENV_PATH}.example`, "utf8");
            }
            contents = upsertEnvValue(contents, "IOT_DEVICE_TOKEN", rawToken);
            contents = upsertEnvValue(contents, "IOT_DEVICE_ID", deviceId);
            fs.writeFileSync(BRIDGE_ENV_PATH, contents, "utf8");
            console.log(`\n  Written to ${BRIDGE_ENV_PATH}`);
        } else {
            console.log("\n  (Re-run with --write-env to have this written for you.)");
        }
    } else {
        console.log("\n  No new token issued — the existing one still works.");
        console.log("  Re-run with --rotate if you have lost it.");
    }

    console.log("\n  Next:  npm run iot:bridge\n");
};

main()
    .catch((err) => {
        console.error(`\nUNEXPECTED ERROR: ${err.stack || err.message}\n`);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
