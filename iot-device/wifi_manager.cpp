#include "pds_config.h"

// COMPILED OUT IN THE USB/SERIAL BUILD.
//
// The Arduino IDE compiles every .cpp/.h in the sketch folder regardless of
// what the .ino includes, so without this guard the default (USB) build would
// fail unless the WiFi and arduinoWebSockets libraries were installed — for a
// transport it does not use. pds_config.h carries the switch and is included
// first for exactly this reason.
//
// The file is guarded rather than deleted: the WiFi/WSS transport is working
// code, and set PDS_TRANSPORT_SERIAL to 0 in pds_config.h to build it again.
#if !PDS_TRANSPORT_SERIAL

#include "wifi_manager.h"
#include <WiFi.h>

void WifiManager::begin(const char* ssid, const char* password) {
    _ssid = ssid;
    _password = password;
    WiFi.mode(WIFI_STA);
    attemptConnect();
}

void WifiManager::attemptConnect() {
    Serial.printf("[WiFi] Connecting to %s (backoff was %lums)...\n", _ssid, _backoffMs);
    WiFi.begin(_ssid, _password);
    _lastAttemptMs = millis();
}

void WifiManager::loop() {
    if (WiFi.status() == WL_CONNECTED) {
        _backoffMs = 1000; // reset backoff once a connection succeeds
        return;
    }

    if (millis() - _lastAttemptMs >= _backoffMs) {
        attemptConnect();
        _backoffMs = min(_backoffMs * 2, MAX_BACKOFF_MS);
    }
}

bool WifiManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

#endif // !PDS_TRANSPORT_SERIAL
