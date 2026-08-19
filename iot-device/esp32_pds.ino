// PDS IoT Weighing — ESP32 + HX711 + 5 kg load cell
//
// Reads a calibrated weight from the load cell and streams it to pds-backend.
// Two transports, selected at compile time in pds_config.h:
//
//   PDS_TRANSPORT_SERIAL 1  (default)  USB serial -> Node.js bridge -> backend
//   PDS_TRANSPORT_SERIAL 0             WiFi + secure WebSocket -> backend
//
// The USB path is the MVP/demo path. It carries no WiFi credentials and no
// device token: the board is a sensor on the end of a cable, the bridge on the
// PC holds the credential, and the backend remains the only thing that decides
// whether a weight becomes a transaction. See README_USB_SERIAL.md for the
// wiring diagram, the calibration procedure and the Arduino-IDE/bridge
// COM-port handover.
//
// The WiFi path is the pre-existing implementation, kept working rather than
// deleted. It needs config.h (git-ignored; copy config.h.example) plus the WiFi
// and arduinoWebSockets libraries.
//
// NO BUSINESS LOGIC LIVES HERE, in either transport. This firmware reports
// grams and hardware faults. It does not know what a ration card, an
// entitlement, a wallet or a session is, and it cannot authorise a dispense.

#include "pds_config.h"
#include "scale.h"

#if PDS_TRANSPORT_SERIAL
#include "device_identity.h"
#include "serial_link.h"
#else
#include "config.h"
#include "wifi_manager.h"
#include "ws_client.h"
#endif

Scale scale;

#if PDS_TRANSPORT_SERIAL
SerialLink link;
#else
WifiManager wifiManager;
WsClient wsClient;
bool wsStarted = false;
bool timeSynced = false;
#endif

unsigned long lastSampleMs = 0;
unsigned long lastSentMs = 0;
unsigned long lastHeartbeatMs = 0;
int lastSentGrams = INT32_MIN; // guarantees the very first reading always sends

// Sensor-fault state. While set, no reading is transmitted: an overloaded or
// disconnected cell must surface as a safety condition, never as a business
// measurement. Deliberately NOT clamped to a legal value — reporting an
// overload as e.g. 4000 g would fabricate a perfect dispense out of a
// hardware fault.
bool sensorFault = false;
unsigned long lastSafetyLogMs = 0;

// A calibration_factor of exactly 1.0 is the NVS default, i.e. "this board has
// never been calibrated". Weight readings from an uncalibrated cell are raw ADC
// counts scaled by nothing, so they are meaningless as grams — the operator is
// told, once, at boot.
static bool isCalibrated() {
    return scale.getCalibrationFactor() != 1.0f;
}

// ---------------------------------------------------------------------------
// Transport-neutral emit helpers. The sample/safety logic below is written once
// and works for either transport, so the two builds cannot drift apart in how
// they treat an overload or a stability window.
// ---------------------------------------------------------------------------

static void emitReading(int grams, unsigned long nowMs) {
#if PDS_TRANSPORT_SERIAL
    link.sendReading(grams, nowMs);
#else
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    const uint64_t epochMs = (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
    wsClient.sendReading(grams, epochMs);
#endif
}

static void emitError(const char* code, const char* detail) {
#if PDS_TRANSPORT_SERIAL
    link.sendError(code, detail);
#else
    // The WiFi build's frame set has no error type (the backend's device frame
    // schema gained one with the USB work); the console line is the record.
    Serial.printf("[SAFETY] %s: %s\n", code, detail ? detail : "");
#endif
}

static void emitLog(const char* message) {
#if PDS_TRANSPORT_SERIAL
    link.sendLog(message);
#else
    Serial.println(message);
#endif
}

// True when the link is ready to carry a reading. Over USB the link is up as
// soon as Serial is: whether anyone is listening is the PC's problem, and
// buffering readings for an absent listener would only deliver stale weights.
static bool linkReady() {
#if PDS_TRANSPORT_SERIAL
    return true;
#else
    return wsClient.isConnected();
#endif
}

// ---------------------------------------------------------------------------
// Calibration interface — see README_USB_SERIAL.md's calibration procedure:
//   t            -> tare (zero the scale; remove all weight first)
//   c<grams>     -> place a known reference weight, then send e.g. "c1000"
//                   for a 1 kg weight to compute + persist calibration_factor
//   id           -> re-emit the hello/identity frame (USB build only)
//
// Kept on the same link the readings use, deliberately: calibrating a scale
// requires watching its output while you adjust it, and a second channel would
// mean the operator could not see both at once.
// ---------------------------------------------------------------------------
static void handleCommand(const String& line) {
    if (line == "t") {
        scale.tare();
        emitLog("Tared.");
        lastSentGrams = INT32_MIN; // force an immediate post-tare reading
        return;
    }

    if (line == "id") {
#if PDS_TRANSPORT_SERIAL
        link.sendHello(isCalibrated(), scale.getCalibrationFactor());
#endif
        return;
    }

    if (line.startsWith("c")) {
        const float knownGrams = line.substring(1).toFloat();
        if (knownGrams <= 0) {
            emitLog("Usage: c<grams>, e.g. c1000 for a 1kg weight");
            return;
        }
        if (knownGrams > PDS_LOAD_CELL_RATED_GRAMS) {
            // Refusing is the safety-relevant behaviour: accepting it would
            // ask the operator to place a weight above the cell's rating on the
            // cell, permanently deforming the strain gauge.
            emitLog("Refused: reference weight exceeds the load cell's rated capacity");
            return;
        }

        const long raw = scale.readRawAverage(10);
        const float factor = raw / knownGrams;
        scale.setCalibrationFactor(factor);

        char message[96];
        snprintf(message, sizeof(message), "Calibrated: raw=%ld known=%.1fg factor=%.4f (saved to NVS)",
                 raw, knownGrams, factor);
        emitLog(message);
        lastSentGrams = INT32_MIN;
        return;
    }

    emitLog("Unknown command. Use 't' to tare, 'c<grams>' to calibrate, 'id' for identity.");
}

static void pollCommands() {
#if PDS_TRANSPORT_SERIAL
    String line;
    if (link.readCommand(line)) {
        handleCommand(line);
    }
#else
    if (!Serial.available()) return;
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
        handleCommand(line);
    }
#endif
}

// ---------------------------------------------------------------------------

void setup() {
#if PDS_TRANSPORT_SERIAL
    link.begin(PDS_SERIAL_BAUD);
#else
    Serial.begin(PDS_SERIAL_BAUD);
    delay(200);
    Serial.println("\n[Boot] PDS IoT weighing device starting...");
#endif

    scale.begin(PDS_HX711_DT_PIN, PDS_HX711_SCK_PIN);

#if PDS_TRANSPORT_SERIAL
    // The identity frame is the first thing on the wire, so a bridge attaching
    // at any moment after boot learns the device UID and firmware version
    // without having to ask. (It can still ask, with `id`.)
    link.sendHello(isCalibrated(), scale.getCalibrationFactor());
    if (!isCalibrated()) {
        link.sendError("NOT_CALIBRATED",
                       "calibration_factor is 1.0 - run the calibration procedure before dispensing");
    }
#else
    Serial.printf("[Boot] Loaded calibration_factor=%.4f from NVS (1.0 means uncalibrated)\n",
                  scale.getCalibrationFactor());
    wifiManager.begin(WIFI_SSID, WIFI_PASSWORD);
#endif
}

void loop() {
    pollCommands();

#if !PDS_TRANSPORT_SERIAL
    wifiManager.loop();

    if (!wifiManager.isConnected()) {
        wsStarted = false; // force a fresh WS handshake once WiFi comes back
        return;
    }

    if (!timeSynced) {
        // ESP32 has no battery-backed RTC, so epoch time is only meaningful
        // once NTP has synced. Blocks for at most ~5 s, once, right after the
        // first WiFi connection.
        configTime(0, 0, "pool.ntp.org", "time.nist.gov");
        struct timeval tv;
        for (uint8_t attempt = 0; attempt < 20; attempt++) {
            gettimeofday(&tv, nullptr);
            if (tv.tv_sec > 8 * 3600 * 2) break; // plausible post-1970 epoch
            delay(250);
        }
        timeSynced = true;
        Serial.println("[Time] NTP sync attempt finished");
    }

    if (!wsStarted) {
        wsClient.begin(BACKEND_HOST, BACKEND_PORT, BACKEND_WS_PATH, DEVICE_ID, DEVICE_TOKEN);
        wsStarted = true;
    }
    wsClient.loop();
#endif

    const unsigned long now = millis();

    // Idle keep-alive. Emitted regardless of sampling so the PC can tell a
    // silent-but-alive device (nothing on the pan) from an unplugged one, and
    // so last_seen_at keeps advancing on the backend. A heartbeat is not a
    // measurement and is never persisted as one.
#if PDS_TRANSPORT_SERIAL
    if (now - lastHeartbeatMs >= PDS_HEARTBEAT_INTERVAL_MS) {
        link.sendHeartbeat(now);
        lastHeartbeatMs = now;
    }
#endif

    if (now - lastSampleMs < PDS_SAMPLE_INTERVAL_MS) {
        return; // non-blocking: just skip this iteration, never delay()
    }
    lastSampleMs = now;

    if (!scale.isReady()) {
        return;
    }

    int grams = scale.readGrams();

    // ---- Hardware safety gate, before the value is treated as a measurement.
    if (grams > PDS_LOAD_CELL_RATED_GRAMS) {
        if (!sensorFault || now - lastSafetyLogMs >= PDS_SAFETY_LOG_INTERVAL_MS) {
            char detail[120];
            snprintf(detail, sizeof(detail),
                     "%d g exceeds the %d g rated capacity - remove weight immediately, sustained overload "
                     "permanently deforms the strain gauge",
                     grams, PDS_LOAD_CELL_RATED_GRAMS);
            emitError("OVERLOAD", detail);
            lastSafetyLogMs = now;
        }
        sensorFault = true;
        lastSentGrams = INT32_MIN; // force a fresh send once the fault clears
        return;                    // never transmit an over-range value
    }

    if (grams < PDS_UNDERRANGE_FAULT_GRAMS) {
        if (!sensorFault || now - lastSafetyLogMs >= PDS_SAFETY_LOG_INTERVAL_MS) {
            char detail[120];
            snprintf(detail, sizeof(detail),
                     "%d g is far below zero - check the load cell is connected and wired the right way "
                     "round, then re-tare ('t')",
                     grams);
            emitError("SENSOR_FAULT", detail);
            lastSafetyLogMs = now;
        }
        sensorFault = true;
        lastSentGrams = INT32_MIN;
        return;
    }

    // Fault clears only once the load is a clear margin below the rating, so a
    // cell resting near the trip point cannot oscillate in and out of it.
    if (sensorFault) {
        if (grams > PDS_OVERLOAD_CLEAR_GRAMS) {
            return; // still in the hysteresis band — stay suspended, stay quiet
        }
        sensorFault = false;
        emitLog("Load is back within the safe range. Weighing resumed.");
    }

    if (grams < 0) grams = 0; // load cell noise can dip slightly negative at rest

    const bool deltaExceeded = abs(grams - lastSentGrams) > PDS_SEND_DELTA_THRESHOLD_G;
    const bool intervalElapsed = (now - lastSentMs) >= PDS_SEND_MAX_INTERVAL_MS;

    if (linkReady() && (deltaExceeded || intervalElapsed)) {
        emitReading(grams, now);
        lastSentGrams = grams;
        lastSentMs = now;
        lastHeartbeatMs = now; // a reading is itself proof of life
    }
}
