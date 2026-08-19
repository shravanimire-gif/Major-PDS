# PDS IoT Bridge (ESP32 → USB serial → PDS backend)

The Windows-side process that owns the ESP32's COM port and relays weight
readings into the PDS backend's existing device protocol.

```
5 kg load cell → HX711 → ESP32
                            │  USB serial (newline-delimited JSON, 115200 baud)
                            ▼
                    Windows PC: iot-bridge
                            │  WebSocket /ws/iot  (device bearer token)
                            ▼
                       pds-backend → PostgreSQL
                            │
                            ▼
        Admin Panel · Shopkeeper Panel · dispense session
                            │
                            ▼
       transaction + dispense_record → analytics · activity · anomaly · blockchain
```

No Wi-Fi. No cloud. No second computer. No MQTT/Redis/broker. The board is a
sensor on the end of a cable; the backend remains the only thing that can turn a
weight into a transaction.

---

## Quick start

```
Terminal 1   npm run dev            # backend + frontend (from the repo root)
Terminal 2   npm run iot:bridge     # this process
```

First-time setup:

```bash
cd iot-bridge
npm install
cp .env.example .env
npm run devices          # find the ESP32's COM port
# register the device in the Admin Panel, paste the token into .env
npm start
```

Expected output:

```
[21:04:11] [IoT] PDS IoT bridge starting (ESP32 -> USB serial -> PDS backend)
[21:04:11] [IoT] Backend: http://localhost:5055/ws/iot
[21:04:11] [IoT] Serial port: auto-detect @ 115200 baud
[21:04:11] [IoT] Bridge health: http://127.0.0.1:5099/health
[21:04:11] [IoT] Found ESP32 on COM5 (auto-detected Silicon Labs CP210x ...)
[21:04:11] [IoT] Serial port COM5 open
[21:04:11] [IoT] Device UID: ESP32-A1B2C3
[21:04:11] [IoT] Firmware: 2.0.0-serial
[21:04:11] [IoT] Connecting to PDS backend at http://localhost:5055/ws/iot...
[21:04:12] [IoT] Device authenticated — backend connection established
[21:04:12] [IoT] Status: ONLINE  (device ESP32-A1B2C3)
[21:04:12] [IoT] Place grain on the scale — readings are now flowing to the PDS backend.
```

---

## Provisioning a device, end to end

1. **Flash the firmware** — open `iot-device/esp32_pds.ino` in the Arduino IDE
   and upload. `pds_config.h` defaults to `PDS_TRANSPORT_SERIAL 1`, so no
   `config.h`, no Wi-Fi credentials and no device token are needed on the board.
2. **Calibrate** — see `iot-device/README_USB_SERIAL.md`. Do this in the Arduino
   Serial Monitor, before starting the bridge.
3. **Read the device UID** — the board prints it in its `hello` line at boot:
   `{"type":"hello","deviceId":"ESP32-A1B2C3",...}`. Or type `id` in the Serial
   Monitor. It is derived from the chip's factory MAC and never changes.
4. **Register it** — Admin Panel → Settings → Devices → *Register Device*. Enter
   the UID, optionally a name, and pick the shop. The token is shown **once**.
5. **Configure the bridge** — paste that token into `iot-bridge/.env` as
   `IOT_DEVICE_TOKEN`.
6. **Close the Arduino Serial Monitor** (see below) and run `npm run iot:bridge`.
7. The Admin Panel shows the device **ONLINE**, with its current weight.

---

## Arduino IDE ↔ bridge: sharing one COM port

Windows gives a serial port to exactly **one** process. The Arduino Serial
Monitor and this bridge cannot both hold it.

| Doing this…                                  | Who owns the port |
| -------------------------------------------- | ----------------- |
| Uploading firmware, calibrating, taring      | Arduino IDE       |
| Running a PDS dispense                       | The bridge        |

**Firmware / calibration workflow**

```
Arduino IDE → COM port → Upload · Serial Monitor · tare (t) · calibrate (c1000)
```

**Demo workflow**

```
Close the Arduino Serial Monitor
        ↓
npm run iot:bridge          (bridge takes the port)
        ↓
ESP32 → PDS backend → Admin Panel
```

If the monitor is still open, the bridge says so in plain language and keeps
retrying — closing the monitor is all that is needed, no restart:

```
[IoT] WARN COM5 is held by another program — almost always the Arduino IDE's
      Serial Monitor (or a Serial Plotter / another bridge instance). Close it
      and the bridge will take the port over automatically. Retrying...
```

Ctrl-C releases the port cleanly, so the Arduino IDE can upload immediately
afterwards.

---

## Commands

All runnable from the repo root:

| Command                | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run iot:bridge`   | Start the bridge                                                     |
| `npm run iot:devices`  | List serial ports and say which one the bridge would use             |
| `npm run iot:sniff`    | Dump raw serial output and show how the parser reads each line       |
| `npm run iot:verify`   | **Physical acceptance test** — 14 checks against the real hardware   |
| `npm run iot:test`     | Bridge unit tests (`node --test`, no hardware needed)                |

`iot:sniff` is the first thing to run when something is wrong: it shows exactly
what the board is putting on the wire, which answers "is this a firmware problem
or a bridge problem" immediately.

`iot:verify` is the physical acceptance test and cannot be satisfied by a
simulator: port discovery, port opens, PDS protocol, stable UID, firmware
version, calibration, sample rate, zeroed pan, response to load, registry
assignment, backend auth, live weight through to the backend, and return to zero.
It creates no transaction — readings without an authorised session are just
sensor data — and prints the UI steps to complete a real dispense.

---

## COM port discovery

`IOT_SERIAL_PORT` is **optional**. Left blank, the bridge auto-detects the board
by USB vendor ID:

| VID    | Chip                                            |
| ------ | ----------------------------------------------- |
| `10c4` | Silicon Labs CP210x — ESP32 DevKitC, NodeMCU-32S |
| `1a86` | QinHeng CH340 / CH9102 — most ESP32 clones      |
| `0403` | FTDI FT232 — ESP32 DevKit v1                    |
| `303a` | Espressif native USB — ESP32-S2 / S3 / C3       |
| `067b` | Prolific PL2303                                 |

Matching is on vendor ID rather than the friendly name, which is localised and
varies by driver version.

Behaviour:

- **exactly one candidate** → used automatically.
- **several candidates** → the bridge refuses to guess and tells you to set
  `IOT_SERIAL_PORT`. Picking one at random would be a coin flip, and the wrong
  board is a scale that silently never reports a weight.
- **`IOT_SERIAL_PORT` set but absent** → hard error, **never** a fallback to
  another port. Opening a different board than you named could stream the wrong
  scale's weights into a live dispense.
- **nothing found** → retries, with a driver/cable checklist.

The port is **re-resolved on every reconnect**, because replugging an ESP32 can
bring it back on a different COM number.

> A COM port is not an identity. `COM5` describes the PC's USB enumeration order.
> The device's identity is the `ESP32-XXXXXX` UID the board derives from its
> factory MAC, and that is what is registered in PostgreSQL and assigned to a shop.

---

## Serial protocol

Newline-delimited JSON, one object per line, readable in the Arduino Serial
Monitor with no tooling.

**Board → PC**

```json
{"type":"hello","deviceId":"ESP32-A1B2C3","firmware":"2.0.0-serial","transport":"serial","cellRatedGrams":5000,"calibrated":true,"calibrationFactor":432.1}
{"type":"reading","grams":2487,"ts":81234}
{"type":"heartbeat","ts":86234}
{"type":"error","code":"OVERLOAD","detail":"5210 g exceeds the 5000 g rated capacity ..."}
{"type":"log","msg":"Tared."}
```

**PC → board**

```
t          tare (remove all weight first)
c<grams>   calibrate against a known weight, e.g. c1000
id         re-emit the hello frame
```

`ts` is `millis()` since boot, **not** epoch — the USB build has no RTC and no
network. The bridge stamps wall-clock time when it forwards a frame, which is
both more accurate and not something the device can misreport.

**The parser also accepts plainer output**, so the bridge works against a bare
HX711 sketch before the firmware is flashed:

| Input                                | Result       |
| ------------------------------------ | ------------ |
| `{"type":"reading","grams":2487}`    | 2487 g       |
| `WEIGHT:2487`, `weight = 2487 g`     | 2487 g       |
| `2487`, `2487.4`, `2487 g`           | 2487 g       |
| `rst:0x1 boot:0x13`, boot banners    | ignored      |
| `{"type":"reading","grams":24`       | ignored (truncated) |
| `{"type":"reading","grams":null}`    | ignored (a missing measurement is not a zero one) |

**Nothing in this protocol carries business state** — no session id, ration card,
shop id, entitlement or wallet balance. A firmware that could name a session
could dispense against a session that was never authorised.

---

## What the bridge does and does not do

**Does**

1. Discover the COM port · 2. open it · 3. detect the ESP32 · 4. learn its UID ·
5. read lines · 6. parse weights · 7. validate them · 8. drop malformed ones ·
9. connect to the backend · 10. authenticate the device · 11. forward readings ·
12. survive a backend disconnect · 13. survive an ESP32 disconnect ·
14. reconnect automatically · 15. log clearly · 16. expose local health.

**Does not** — and has no code path that could:

- calculate an entitlement or allocation
- read or write a wallet balance
- authorise a beneficiary
- decide whether a measurement is within tolerance
- decide whether a dispense may complete
- talk to PostgreSQL
- create a transaction or a dispense_record
- anchor anything on-chain

Every one of those happens in `pds-backend`, inside a single database
transaction. That is why a yanked USB cable or a killed bridge cannot debit a
wallet.

---

## Failure states

| Situation                      | What happens                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- |
| ESP32 unplugged                | Serial closes; readings stop. Backend's idle sweep flips the device to OFFLINE. Bridge retries and re-resolves the port. |
| COM port held by Arduino IDE   | Named explicitly in the log; retries until the monitor is closed.             |
| ESP32 reset                    | Port reopens, board re-sends `hello`, streaming resumes. The backend socket is held across a brief drop so a reset is not a visible outage. |
| Bridge not running             | Admin Panel shows OFFLINE. Nothing else is affected.                          |
| Backend down / restarting      | Exponential backoff 1 s → 30 s. Readings are **dropped, not queued** — a stale weight replayed into a live session would describe a pan that has since changed. |
| Device not registered          | HTTP 401, explained in the log, retried. Registering it in the Admin Panel is enough; no bridge restart. |
| Device disabled / revoked      | Backend closes with code 1008 and a reason. Logged as an Admin Panel problem, not a cable problem. |
| Device unassigned from a shop  | Handshake refused. An unassigned device is registered but inert.               |
| Device assigned to another shop| It can only ever stream for its own shop; the backend derives the shop from the registered row and ignores anything the device says. |
| Invalid / malformed serial data| Dropped with a debug log. Never crashes the process.                          |
| Negative reading               | Small negatives (≥ −5 g, load-cell noise at rest) floor to 0. Larger negatives are forwarded so the backend rejects them **and** counts them toward `needs_recalibration` — a cell that is unplugged or wired backwards must not look merely quiet. |
| Overload (> 5000 g)            | The board latches a fault, stops sending readings, and reports `error/OVERLOAD` with no grams value. |
| Session expired / cancelled    | Backend concern; the bridge keeps streaming readings, which simply gate nothing. |
| Weight outside tolerance       | Backend refuses the commit (`failed_out_of_tolerance`). Nothing is debited.    |

An `uncaughtException` is logged and the process **continues** — a relay must not
die mid-demo, and it holds no state whose loss could corrupt anything.

---

## Local health endpoint

```bash
curl http://127.0.0.1:5099/health
```

```json
{
  "bridge":  { "status": "online", "deviceId": "ESP32-A1B2C3", "firmware": "2.0.0-serial", "uptimeSeconds": 412 },
  "serial":  { "open": true, "path": "COM5", "baud": 115200, "chip": "Silicon Labs CP210x ...", "linesSeen": 4120, "linesUnparsed": 3 },
  "backend": { "connected": true, "backendUrl": "http://localhost:5055", "readingsForwarded": 4117, "readingsDropped": 0 },
  "reading": { "lastGrams": 2487, "lastAt": "2026-08-18T21:11:02.441Z", "lastDeviceError": null }
}
```

`status` is one of `online`, `waiting_for_device`, `waiting_for_identity`,
`waiting_for_backend`, `identity_mismatch` — so when the Admin Panel says OFFLINE,
this says *which* of the four possible causes it is. Returns 503 unless `online`.

Bound to `127.0.0.1` only, and **never** contains the device token: every log line
goes through `logger.redact()` and the snapshot has no credential field.

---

## Environment variables

See `.env.example` for the annotated version. `.env` is git-ignored.

| Variable                   | Default                      | Notes                                                        |
| -------------------------- | ---------------------------- | ------------------------------------------------------------ |
| `IOT_SERIAL_PORT`          | *(auto-detect)*              | e.g. `COM5`. Pin only if auto-detection is ambiguous.        |
| `IOT_SERIAL_BAUD`          | `115200`                     | Must match the firmware's `PDS_SERIAL_BAUD`.                  |
| `IOT_BACKEND_URL`          | `http://localhost:<PORT>`    | Falls back to `PORT` from `pds-backend/.env`.                 |
| `IOT_DEVICE_TOKEN`         | —                            | **Required.** From the Admin Panel, shown once.               |
| `IOT_DEVICE_ID`            | *(from the board)*           | Set to pin a UID; a mismatched board is then refused.         |
| `IOT_HEARTBEAT_MS`         | `15000`                      | Must stay below the backend's 45 s idle timeout.              |
| `IOT_RECONNECT_INITIAL_MS` | `1000`                       |                                                               |
| `IOT_RECONNECT_MAX_MS`     | `30000`                      |                                                               |
| `IOT_BRIDGE_HEALTH_PORT`   | `5099`                       | Loopback only.                                                |
| `IOT_BRIDGE_DEBUG`         | *(off)*                      | Per-reading logging. Chatty at 10 Hz.                         |
| `IOT_SIMULATE`             | `false`                      | Synthetic readings, no COM port. **Not a hardware test.**      |
| `IOT_SIMULATE_TARGET_GRAMS`| `0`                          | Weight the simulator ramps to and holds.                      |

### Why the token lives here, not on the ESP32

A credential compiled into firmware is a credential in every Serial Monitor
session and in every copied `.ino`. Over USB the PC is already a trusted,
physically-attached peer, so the board carries **no secret at all** and the
bridge holds the device token in its environment. The backend still authenticates
the device — it authenticates the bridge presenting that device's token, over the
same `/ws/iot` handshake the Wi-Fi firmware used.

---

## Simulation mode (not a hardware test)

```bash
IOT_SIMULATE=true IOT_SIMULATE_TARGET_GRAMS=3000 npm start
```

Exercises the real bridge, the real WebSocket protocol, the real backend, the
real database and the real Admin Panel with only the physical sensor replaced.
Useful for verifying the software path when the board is not attached.

It proves **nothing** about the HX711, the wiring, the calibration or the COM
port. The synthetic UID is prefixed `SIM32-` (never `ESP32-`) so a simulated
device cannot be mistaken for real hardware in the registry or in a screenshot,
and every log line says `SIMULATED`.

---

## Tests

```bash
npm test        # 92 tests, node --test, no hardware required
```

- `serialParser.test.js` — every input format, malformed frames, boot chatter,
  negative/over-range values, the `grams: null` trap.
- `portDiscovery.test.js` — single/ambiguous/absent candidates, pinned ports,
  case-insensitive matching, the no-silent-fallback rule.
- `backendClient.test.js` — runs against a **real** WebSocket server: handshake
  URL and subprotocol, frame shapes, heartbeats, reconnect, backoff reset, HTTP
  401 recovery, unreachable backend.
- `bridge.test.js` — identity handshake, pinned-UID mismatch stop, reading relay,
  fault relay, disconnect behaviour, no-credential-in-health.
