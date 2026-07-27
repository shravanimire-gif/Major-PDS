// PDS IoT Weighing — Phase 1 ("the spine")
//
// Reads a calibrated weight from the load cell, streams it to pds-backend
// over a secure WebSocket whenever WiFi + the backend are reachable, and
// otherwise just keeps retrying. No confirmation/gating logic here — that's
// Phase 2 (see PHASE1_DONE.md). All Wi-Fi/backend/device secrets live in
// config.h (git-ignored) — copy config.h.example to config.h and fill it in
// before flashing.
//
// Wiring + calibration procedure: see README.md.

#include "config.h"
#include "wifi_manager.h"
#include "ws_client.h"
#include "scale.h"

// HX711 wiring — see README.md for the full diagram.
static const uint8_t HX711_DT_PIN = 4;
static const uint8_t HX711_SCK_PIN = 5;

static const unsigned long SAMPLE_INTERVAL_MS = 100;   // HX711 sampled at 10 Hz
static const int SEND_DELTA_THRESHOLD_G = 2;           // send if the reading moved by >2g...
// ...OR this many ms have passed, whichever first. Phase 2's auto-confirm
// rule needs >=15 readings in a 3s window even at a dead-stable weight; at
// the original 500ms this was mathematically impossible (max 6 readings/3s)
// — tightened to match the HX711's actual 10Hz sample rate. The >2g
// delta-debounce above is unchanged, so traffic still drops when the weight
// is genuinely stable, just less aggressively. See PHASE2_DONE.md.
static const unsigned long SEND_MAX_INTERVAL_MS = 100;

WifiManager wifiManager;
WsClient wsClient;
Scale scale;

unsigned long lastSampleMs = 0;
unsigned long lastSentMs = 0;
int lastSentGrams = INT32_MIN; // guarantees the very first reading always sends
bool wsStarted = false;
bool timeSynced = false;

// ESP32 has no battery-backed RTC, so epoch time is only meaningful once NTP
// has synced over the freshly-connected WiFi link. This blocks for at most
// ~5s, once, right after the first WiFi connection — a one-time startup
// cost, not part of the recurring non-blocking loop below.
void syncTimeOnce() {
    if (timeSynced) return;

    configTime(0, 0, "pool.ntp.org", "time.nist.gov");

    struct timeval tv;
    for (uint8_t attempt = 0; attempt < 20; attempt++) {
        gettimeofday(&tv, nullptr);
        if (tv.tv_sec > 8 * 3600 * 2) { // plausible post-1970 epoch, not the power-on default
            break;
        }
        delay(250);
    }
    timeSynced = true;
    Serial.println("[Time] NTP sync attempt finished");
}

uint64_t currentEpochMs() {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// Serial calibration interface — see README.md's calibration procedure:
//   t            -> tare (zero the scale; remove all weight first)
//   c<grams>     -> place a known reference weight, then send e.g. "c1000"
//                   for a 1kg weight to compute + persist calibration_factor
void handleSerialCalibrationCommands() {
    if (!Serial.available()) return;

    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return;

    if (line == "t") {
        scale.tare();
        Serial.println("[Cal] Tared.");
    } else if (line.startsWith("c")) {
        float knownGrams = line.substring(1).toFloat();
        if (knownGrams <= 0) {
            Serial.println("[Cal] Usage: c<grams>, e.g. c1000 for a 1kg weight");
            return;
        }
        long raw = scale.readRawAverage(10);
        float factor = raw / knownGrams;
        scale.setCalibrationFactor(factor);
        Serial.printf("[Cal] raw=%ld knownGrams=%.1f -> calibration_factor=%.4f (saved)\n", raw, knownGrams, factor);
    } else {
        Serial.println("[Cal] Unknown command. Use 't' to tare or 'c<grams>' to calibrate.");
    }
}

void setup() {
    Serial.begin(115200);
    delay(200);
    Serial.println("\n[Boot] PDS IoT weighing device starting...");

    scale.begin(HX711_DT_PIN, HX711_SCK_PIN);
    Serial.printf("[Boot] Loaded calibration_factor=%.4f from NVS (1.0 means uncalibrated — run the README's calibration procedure)\n",
                  scale.getCalibrationFactor());

    wifiManager.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
    handleSerialCalibrationCommands();

    wifiManager.loop();

    if (!wifiManager.isConnected()) {
        wsStarted = false; // force a fresh WS handshake once WiFi comes back
        return;
    }

    syncTimeOnce();

    if (!wsStarted) {
        wsClient.begin(BACKEND_HOST, BACKEND_PORT, BACKEND_WS_PATH, DEVICE_ID, DEVICE_TOKEN);
        wsStarted = true;
    }
    wsClient.loop();

    unsigned long now = millis();
    if (now - lastSampleMs < SAMPLE_INTERVAL_MS) {
        return; // non-blocking: just skip this iteration, never delay()
    }
    lastSampleMs = now;

    if (!scale.isReady()) {
        return;
    }

    int grams = scale.readGrams();
    if (grams < 0) grams = 0; // load cell noise can dip slightly negative at rest

    bool deltaExceeded = abs(grams - lastSentGrams) > SEND_DELTA_THRESHOLD_G;
    bool intervalElapsed = (now - lastSentMs) >= SEND_MAX_INTERVAL_MS;

    if (wsClient.isConnected() && (deltaExceeded || intervalElapsed)) {
        wsClient.sendReading(grams, currentEpochMs());
        lastSentGrams = grams;
        lastSentMs = now;
    }
}
