#pragma once
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
