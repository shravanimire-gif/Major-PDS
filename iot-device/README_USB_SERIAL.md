# ESP32 firmware — USB serial build

Wiring, calibration and the Arduino-IDE workflow for the PDS weighing device.

The board is a **sensor**. It reports grams and hardware faults over USB serial.
It has no idea what a ration card, an entitlement, a wallet or a session is, and
it cannot authorise a dispense — that is the backend's job, and keeping it there
is what makes an unplugged cable harmless.

---

## Hardware

| Part           | Detail                                          |
| -------------- | ----------------------------------------------- |
| MCU            | ESP32 dev board (DevKitC / NodeMCU-32S / clone) |
| Amplifier      | HX711 24-bit load-cell amplifier                |
| Load cell      | 5 kg strain gauge (4-wire)                      |
| Link to the PC | USB, 115200 baud                                |

### Wiring

**Load cell → HX711**

| Load cell wire | HX711 |
| -------------- | ----- |
| Red            | `E+`  |
| Black          | `E-`  |
| White          | `A-`  |
| Green          | `A+`  |

Colours vary by manufacturer. If the reading goes _negative_ when you add
weight, swap `A+` and `A-`.

**HX711 → ESP32**

| HX711 | ESP32                           |
| ----- | ------------------------------- |
| `VCC` | `3V3`                           |
| `GND` | `GND`                           |
| `DT`  | `GPIO 5` (`PDS_HX711_DT_PIN`)   |
| `SCK` | `GPIO 18` (`PDS_HX711_SCK_PIN`) |

Both pins are set in `pds_config.h`; change them there, not in the `.ino`.

### Load-cell safety — three different ceilings

Do not conflate these. They exist separately on purpose.

| Limit      | What it is                                                                                                               | Where it lives                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **4000 g** | **Business allocation.** The most one household may receive for one commodity, in the one transaction that fulfils it.   | `MAX_DISPENSE_TRANSACTION_GRAMS`, `pds-backend/src/config/allocation.js` — plus CHECK constraints on `policies`, so no arithmetic can produce a larger allocation. |
| **5000 g** | **Hardware rating.** Above this the number is not a measurement at all.                                                  | `PDS_LOAD_CELL_RATED_GRAMS` here, mirrored by `MAX_VALID_GRAMS` in `pds-backend/src/config/iot.js`.                                                                |
| **~20 g**  | **Measurement tolerance.** How far a physical weighing may deviate from the allocation and still count as fulfilling it. | The `commodity_tolerances` table.                                                                                                                                  |

A 4500 g reading is hardware-safe and business-invalid. A 5100 g reading is
hardware-invalid. **Tolerance is measurement acceptance — it never increases
what a beneficiary is entitled to.**

Never place more than 5 kg on the cell. Sustained overload permanently deforms
the strain gauge. The firmware latches an `OVERLOAD` fault above the rating and
stops sending readings until the load drops below 4500 g (hysteresis, so a cell
resting at the trip point cannot flap in and out of the fault at 10 Hz).

---

## Arduino IDE setup

1. **Board support** — Boards Manager → install _esp32 by Espressif Systems_.
   Select your board (e.g. _ESP32 Dev Module_).
2. **Library** — Library Manager → install **"HX711 Arduino Library" by Bogdan
   Necula (bogde)**. `scale.cpp` uses `begin`, `tare`, `set_scale`, `get_units`,
   `read_average` and `is_ready`, which is that library's API.

   If you already had the board printing `Raw value: -26052.00`, you are almost
   certainly on this library already: that output is `get_units()` printed with
   two decimals while the scale factor is still 1.0, i.e. raw ADC counts.

   Beware of same-named alternatives — `HX711_ADC` (Olav Kallhovd) and Rob
   Tillaart's `HX711` have different APIs and will not compile against
   `scale.cpp`.

3. **Open** `esp32_pds.ino`. The whole folder compiles as one sketch.
4. **Upload.** Serial Monitor at **115200 baud**.

Nothing else is required for the USB build. No Wi-Fi library, no
`arduinoWebSockets`, and **no `config.h`** — `wifi_manager.*` and `ws_client.*`
are compiled out (see _Transport switch_ below).

---

## Transport switch

`pds_config.h`:

```c
#define PDS_TRANSPORT_SERIAL 1   // USB serial → iot-bridge → backend   (default)
#define PDS_TRANSPORT_SERIAL 0   // Wi-Fi + secure WebSocket → backend  (pre-existing)
```

`pds_config.h` is included by **every** file in the sketch. That matters: the
Arduino IDE compiles every `.cpp` in the folder regardless of what the `.ino`
includes, so a `#define` that lived only in the `.ino` could not switch code out
of `ws_client.cpp`. Putting the switch in a shared header is what lets the USB
build compile with no networking libraries installed at all.

The Wi-Fi transport is **guarded, not deleted** — it is working code. Setting the
switch to `0` builds it again, and it then needs `config.h` (copy
`config.h.example`) plus the Wi-Fi and `arduinoWebSockets` libraries.

**The USB build carries no secret.** No Wi-Fi password, no device token. The
device token lives in `iot-bridge/.env` on the PC, because a credential compiled
into firmware is a credential in every Serial Monitor session and every copied
sketch.

---

## Device identity

The board derives its own UID from the ESP32's factory-programmed eFuse MAC:

```
ESP32-A1B2C3
```

…the last three octets of the MAC in uppercase hex. It survives reflashing,
replugging, moving to another USB socket and rebooting the PC.

**A COM port is not an identity.** Windows assigns `COM3`/`COM5`/`COM11` from its
own USB enumeration order, so a port number describes the cable, not the board.
`iot_devices.device_id` holds this UID, and the bridge presents it at the
`/ws/iot` handshake — so the physical board and the database row refer to the same
thing by construction.

It is an _identifier_, not a credential: it travels in a URL query parameter and
appears in logs. Authorisation is the device token, held by the bridge. And it is
deliberately not configurable in firmware — a settable device_id would let two
boards claim one identity, and the backend's device → shop → session binding would
then resolve the wrong hardware.

Read it at boot, or type `id` in the Serial Monitor:

```json
{
  "type": "hello",
  "deviceId": "ESP32-A1B2C3",
  "firmware": "2.1.0-serial",
  "transport": "serial",
  "cellRatedGrams": 5000,
  "calibrated": true,
  "calibrationFactor": 432.1
}
```

---

## Arduino CLI compile and upload

Install Arduino CLI and the ESP32 core once, then install the Bogde HX711
library used by `scale.cpp`:

```sh
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install "HX711 Arduino Library"
```

From the repository root, compile the USB firmware for an ESP32 Dev Module:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32 iot-device/esp32_pds
```

Find the connected board, replacing `/dev/cu.usbmodemXXXX` below with the port
reported by `board list`, then flash at 115200 baud:

```sh
arduino-cli board list
arduino-cli upload --fqbn esp32:esp32:esp32 --port /dev/cu.usbmodemXXXX --upload-property upload.speed=115200 iot-device/esp32_pds
```

The firmware serial protocol remains at 115200 baud. Open the serial monitor
at that rate after uploading:

```sh
arduino-cli monitor --port /dev/cu.usbmodemXXXX --config baudrate=115200
```

## Calibration CLI

The bridge must release the ESP32 port before calibration. Stop the running
bridge with `Ctrl-C`, then run this exact command from the repository root:

```sh
node iot-device/calibrate.js /dev/cu.usbmodemXXXX t
```

Use `c` instead of `t` to start the existing guided 1000 g calibration:

```sh
node iot-device/calibrate.js /dev/cu.usbmodemXXXX c
```

The helper opens the port at 115200 baud, sends the existing newline-terminated
firmware command, prints the ESP32 response, and exits automatically. It keeps
the port open for 12 seconds for `c` so the five-second guided calibration can
finish, and for 4 seconds for `t`. It refuses to run if `iot-bridge` owns the
selected port. After calibration completes, restart the bridge:

```sh
npm run iot:bridge
```

The helper uses the `serialport` dependency already installed for `iot-bridge`;
run `npm install` in `iot-bridge` first if that dependency is missing. It does
not change the firmware protocol or bridge architecture.

## Calibration

Do this **before** the first dispense, in the Arduino Serial Monitor (115200 baud),
with the bridge **not** running. The calibration factor and empty-scale tare
offset are persisted to NVS, so they survive reboots and power loss — once per
board is enough.

An uncalibrated board does not emit production weight readings. It reports the
calibration requirement instead:

```json
{
  "type": "error",
  "code": "NOT_CALIBRATED",
  "detail": "calibration_factor is 1.0 - run the calibration procedure before dispensing"
}
```

**Procedure**

1. Mount the load cell and its platform. Nothing should be on the pan.
   The container/platform contributes load, so include it before taring.
2. Send `t` — tare. The monitor prints `TARE COMPLETE` and `WEIGHT: 0.00 g`.
3. Send `c` — the firmware asks for exactly 1000 g and waits five seconds.
4. Place the known **1 kg** weight on the pan during that five-second wait. The
   firmware reads the HX711, calculates the signed raw-counts-per-gram factor,
   and saves it to NVS. A negative factor is valid when the load-cell signal
   polarity is reversed; the resulting physical weight remains positive.
5. Remove the weight and send `t` again to verify the empty-scale zero. This
   updated tare offset is also saved to NVS.
6. Put the 1 kg weight back. The JSON `reading` frames should be near 1000 g.

For a different known weight, send `c<grams>` instead, for example `c500`, but
never place more than 5000 g on the 5 kg load cell.

A reference weight above the cell's rating is **refused** — accepting it would ask
you to overload the cell as part of the procedure.

### Commands

| Send       | Effect                                              |
| ---------- | --------------------------------------------------- |
| `t`        | Tare — zero the scale (remove all weight first)     |
| `c`        | Guided calibration using exactly 1000 g             |
| `c<grams>` | Guided calibration using the specified known weight |
| `id`       | Re-emit the `hello` / identity frame                |

> **Set the Serial Monitor's line ending to "Newline" (or "Both NL & CR").**
> Commands are newline-terminated, so with the Arduino IDE's line ending set to
> "No line ending" the board never sees the end of what you typed and appears to
> ignore every command. The bridge always sends `
`, so this only affects typing
> by hand.

Commands share the same link as the readings, deliberately: calibrating a scale
means watching its output while you adjust it, and a second channel would mean
not being able to see both at once.

---

## Serial output

```json
{"type":"hello","deviceId":"ESP32-A1B2C3","firmware":"2.1.0-serial","transport":"serial","cellRatedGrams":5000,"calibrated":true,"calibrationFactor":432.1}
{"type":"reading","grams":2487,"ts":81234}
{"type":"heartbeat","ts":86234}
{"type":"error","code":"OVERLOAD","detail":"5210 g exceeds the 5000 g rated capacity ..."}
{"type":"error","code":"SENSOR_FAULT","detail":"-350 g is far below zero - check the load cell is connected ..."}
{"type":"log","msg":"TARE COMPLETE"}
{"type":"log","msg":"CALIBRATION READING: raw ADC=432100 tare-adjusted=432100 known=1000 g"}
{"type":"log","msg":"CALIBRATION COMPLETE: factor=432.1000 saved to NVS; final weight=1000.00 g"}
```

- **`reading`** — sampled at 10 Hz; sent when the weight moves more than 2 g, or
  at least every 100 ms. The 10 Hz rate is required: the backend's auto-confirm
  rule needs ≥ 15 readings inside a 3 s window even at a dead-stable weight.
- **`heartbeat`** — every 5 s while idle, so the PC can tell "alive and reading
  0 g" from "unplugged". A separate frame type rather than a 0 g reading, because
  a reading is a measurement and gets persisted.
- **`error`** — a hardware fault. **Carries no grams value, ever**: an overload
  reported as a number would be indistinguishable from a measurement, and a
  4000 g "overload" would fabricate a perfect dispense out of a broken cell.
- **`ts`** — `millis()` since boot, **not** epoch. No RTC, and no network in this
  build. The bridge stamps wall-clock time when it forwards a frame, which is
  more accurate and not something the device can misreport.

---

## COM port handover: Arduino IDE ↔ bridge

Windows gives a serial port to exactly **one** process.

```
FIRMWARE / CALIBRATION                  PDS DEMO
  Arduino IDE                             Close the Arduino Serial Monitor
      ↓                                       ↓
  COM port                                npm run iot:bridge
      ↓                                       ↓
  Upload · Serial Monitor · t / c1000     Bridge owns the COM port
                                              ↓
                                          ESP32 → PDS backend → Admin Panel
```

Leave the Serial Monitor open and the bridge says exactly that, and keeps
retrying — closing the monitor is all that is needed. `Ctrl-C` on the bridge
releases the port so the IDE can upload immediately.

---

## What changed from the Wi-Fi firmware

| Kept unchanged                                                          | Added                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `scale.h` / `scale.cpp` — HX711, tare, NVS-persisted calibration factor | `pds_config.h` — pin map, safety limits, transport switch       |
| Overload latch + hysteresis + underrange fault detection                | `device_identity.*` — MAC-derived stable UID                    |
| 10 Hz sampling, 2 g delta debounce                                      | `serial_link.*` — NDJSON transport, non-blocking command reader |
| Non-blocking loop, never `delay()`                                      | `heartbeat` and `error` frame types                             |
| `t` / `c<grams>` calibration commands                                   | `id` command                                                    |
| `wifi_manager.*`, `ws_client.*` (guarded, still buildable)              | Refusal to calibrate against an over-rating reference weight    |

No business authorisation logic was moved into the firmware, and none was
removed from the backend.
