#!/usr/bin/env node

"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const serialportPackage = path.join(
  __dirname,
  "..",
  "iot-bridge",
  "node_modules",
  "serialport",
);
let SerialPort;
try {
  ({ SerialPort } = require(serialportPackage));
} catch (error) {
  console.error(
    "serialport is unavailable. Run npm install in iot-bridge first.",
  );
  console.error(`Expected dependency at: ${serialportPackage}`);
  process.exit(1);
}

const [, , portPath, command = "t"] = process.argv;
const allowedCommands = new Set(["t", "c"]);
const listenMs = command === "c" ? 12000 : 4000;

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error("Usage: node iot-device/calibrate.js /dev/cu.usbmodemXXXX t|c");
  console.error("Run from the repository root, with iot-bridge stopped.");
  process.exit(2);
}

if (!portPath || !allowedCommands.has(command)) {
  usage("port and command are required; command must be t or c");
}

const ownerCheck = spawnSync("lsof", ["-t", portPath], { encoding: "utf8" });
const ownerPids =
  ownerCheck.status === 0
    ? ownerCheck.stdout.trim().split(/\s+/).filter(Boolean)
    : [];
for (const ownerPid of ownerPids) {
  const owner = spawnSync("ps", ["-p", ownerPid, "-o", "command="], {
    encoding: "utf8",
  }).stdout.trim();
  if (owner.includes("iot-bridge")) {
    console.error(`${portPath} is owned by iot-bridge (PID ${ownerPid}).`);
    console.error(
      "Stop it with Ctrl-C, run calibration, then restart it with:",
    );
    console.error("  npm run iot:bridge");
    process.exit(1);
  }
}

const port = new SerialPort({
  path: portPath,
  baudRate: 115200,
  autoOpen: false,
});

let timer;
let finished = false;

function finish(exitCode = 0) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (port.isOpen) {
    port.close(() => process.exit(exitCode));
  } else {
    process.exit(exitCode);
  }
}

port.on("data", (chunk) => {
  process.stdout.write(chunk.toString());
});

port.on("error", (error) => {
  console.error(`Could not open or use ${portPath}: ${error.message}`);
  console.error("Make sure the iot-bridge and any serial monitor are stopped.");
  finish(1);
});

port.open((error) => {
  if (error) {
    console.error(`Could not open ${portPath}: ${error.message}`);
    console.error(
      "Make sure the iot-bridge and any serial monitor are stopped.",
    );
    finish(1);
    return;
  }

  // Opening an ESP32 USB serial port can reset the board. Let its hello frame
  // arrive, then send the existing CRLF-terminated firmware command. The
  // firmware accepts either delimiter and ignores the second byte of CRLF.
  setTimeout(() => {
    const commandFrame = Buffer.from(`${command}\r\n`, "ascii");
    port.write(commandFrame, (writeError) => {
      if (writeError) {
        console.error(`Could not send ${command}: ${writeError.message}`);
        finish(1);
        return;
      }
      console.error(
        `Sent ${command}; listening for ESP32 responses for ${
          listenMs / 1000
        }s...`,
      );
      timer = setTimeout(() => finish(0), listenMs);
    });
  }, 1000);
});

process.on("SIGINT", () => finish(0));
