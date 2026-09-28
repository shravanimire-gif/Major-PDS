#pragma once

// ---------------------------------------------------------------------------
// PDS IoT weighing device — build configuration.
//
// This header is included by EVERY translation unit in the sketch (the .ino
// and all the .cpp files). That matters: the Arduino IDE compiles every .cpp
// in the sketch folder regardless of what the .ino does, so a `#define` that
// lived only in esp32_pds.ino could not switch code out of wifi_manager.cpp or
// ws_client.cpp. Putting the switch here is what makes the USB build compile
// with no WiFi/WebSocket libraries installed at all.
// ---------------------------------------------------------------------------

// TRANSPORT
// ---------
// 1 = USB serial (the MVP/demo path, and the default).
//     The board streams newline-delimited JSON over the USB CDC/UART link.
//     A Node.js bridge on the PC (iot-bridge/) owns the COM port and relays
//     frames to pds-backend. NOTHING network-related is compiled in: no
//     WIFI_SSID, no backend host, no device token on the board.
//
// 0 = WiFi + secure WebSocket direct to pds-backend (the pre-existing path,
//     kept intact rather than deleted). Requires config.h (git-ignored) with
//     WIFI_SSID / WIFI_PASSWORD / BACKEND_HOST / BACKEND_PORT /
//     BACKEND_WS_PATH / DEVICE_ID / DEVICE_TOKEN, plus the WiFi and
//     arduinoWebSockets libraries.
//
// WHY SERIAL HAS NO DEVICE TOKEN
// A credential on the board is a credential in every Serial Monitor session
// and in every .ino someone copies. Over USB the PC is already a trusted,
// physically-attached peer, so the device token lives in the bridge's
// environment (iot-bridge/.env) and the board carries no secret at all. The
// backend still authenticates the device — it authenticates the bridge holding
// that device's token. See iot-bridge/README.md.
#define PDS_TRANSPORT_SERIAL 1

// Reported to the backend in the `hello` frame and stored in
// iot_devices.firmware_version, so the Admin Panel shows what is actually
// running on the board. Bump this when you change firmware behaviour.
#define PDS_FIRMWARE_VERSION "2.1.0-serial"

// USB serial baud. 115200 is what the pre-existing firmware already used for
// its console, so Arduino's Serial Monitor at 115200 keeps working unchanged
// and the bridge's default (IOT_SERIAL_BAUD) matches it.
#define PDS_SERIAL_BAUD 115200

// HX711 wiring — see the wiring notes in README_USB_SERIAL.md.
#define PDS_HX711_DT_PIN 5
#define PDS_HX711_SCK_PIN 18

// Default calibration configuration matching teammate HX711 setup
#define PDS_DEFAULT_ZERO_RAW -27536.5f
#define PDS_DEFAULT_CALIBRATION_FACTOR -397.7152f // (-397715.2 / 1000.0)


// ---- LOAD-CELL SAFETY -----------------------------------------------------
// Rated capacity of the cell this device is built around. A standard 5 kg
// strain-gauge cell tolerates roughly 120% (6000 g) without permanent damage
// and is destroyed near 150% (7500 g), so tripping at the rating leaves ~1 kg
// of margin before the strain gauge is at any risk of deforming.
//
// This is a HARDWARE limit. It is NOT the business allocation limit and NOT
// the measurement tolerance. Three separate ceilings, deliberately different:
//
//   4000 g  business allocation  (MAX_DISPENSE_TRANSACTION_GRAMS,
//                                 pds-backend/src/config/allocation.js) — the
//                                 most one household may receive for one
//                                 commodity in the one transaction that
//                                 fulfils it.
//   5000 g  hardware rating      (here, and MAX_VALID_GRAMS in
//                                 pds-backend/src/config/iot.js) — above this
//                                 the number is not a measurement at all.
//   ~20 g   measurement tolerance (commodity_tolerances table) — how far a
//                                 physical weighing may deviate from the
//                                 allocation and still count as fulfilling it.
//
// A 4500 g reading is hardware-safe and business-invalid. A 5100 g reading is
// hardware-invalid. Keep this value in step with MAX_VALID_GRAMS; the backend
// re-checks independently and must never be more permissive.
#define PDS_LOAD_CELL_RATED_GRAMS 5000

// Overload latches, so a cell hovering at the trip point cannot flap in and
// out of the fault state at the sample rate. It clears once the load drops a
// clear margin below the rating.
#define PDS_OVERLOAD_CLEAR_GRAMS 4500

// A reading this far below zero is not tare drift, it is a fault: cell
// unplugged, wired in reverse, or the amplifier has lost its reference.
// Small negatives are still treated as noise and floored to 0.
#define PDS_UNDERRANGE_FAULT_GRAMS -200

// ---- SAMPLING / TRANSMISSION ----------------------------------------------
// HX711 sampled at 10 Hz.
#define PDS_SAMPLE_INTERVAL_MS 100

// Send if the reading moved by more than this...
#define PDS_SEND_DELTA_THRESHOLD_G 2
// ...OR this many ms have passed, whichever comes first. The backend's
// auto-confirm rule needs >=15 readings within a 3 s window even at a
// dead-stable weight (STABILITY_MIN_READINGS / STABILITY_WINDOW_MS in
// pds-backend/src/config/iot.js), which is only achievable at the full 10 Hz.
#define PDS_SEND_MAX_INTERVAL_MS 100

// Emitted while the scale is idle so the PC/backend can distinguish "device is
// alive and reading 0 g" from "device is gone". Deliberately a separate frame
// type, not a 0 g reading: a reading is a measurement and gets persisted.
#define PDS_HEARTBEAT_INTERVAL_MS 5000

// Hardware-fault log lines are rate-limited — at 10 Hz an unguarded print
// would flood the link and slow the sample loop.
#define PDS_SAFETY_LOG_INTERVAL_MS 1000
