#pragma once
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
#include <Arduino.h>

// Non-blocking WiFi connection manager with exponential backoff
// (1s, 2s, 4s, ... capped at 30s). Call begin() once in setup(), then
// loop() on every main-loop iteration — it never calls delay().
class WifiManager {
public:
    void begin(const char* ssid, const char* password);
    void loop();
    bool isConnected() const;

private:
    const char* _ssid = nullptr;
    const char* _password = nullptr;
    unsigned long _lastAttemptMs = 0;
    unsigned long _backoffMs = 1000;
    static const unsigned long MAX_BACKOFF_MS = 30000;

    void attemptConnect();
};

#endif // !PDS_TRANSPORT_SERIAL
