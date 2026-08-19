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
#include <WebSocketsClient.h>

// Wraps WebSocketsClient (Links2004/arduinoWebSockets — see README.md for the
// exact library to install) for the device-facing /ws/iot endpoint.
//
// Auth: the device's bearer token rides in the Sec-WebSocket-Protocol header
// (constraint from pds-backend/src/ws/iotSocketServer.js), via beginSSL()'s
// `protocol` argument below — never hardcoded, always read from config.h.
//
// TLS: beginSSL() is called with an empty fingerprint, i.e. no certificate
// pinning. This is a deliberate Phase 1 simplification (see README.md) —
// revisit before any production rollout beyond a bench/pilot setup.
class WsClient {
public:
    void begin(const char* host, uint16_t port, const char* path, const char* deviceId, const char* deviceToken);
    void loop(); // non-blocking; call every main loop iteration
    void sendReading(int grams, uint64_t epochMs);
    bool isConnected() const { return _connected; }

private:
    WebSocketsClient _ws;
    String _path;
    bool _connected = false;
    unsigned long _backoffMs = 1000;
    static const unsigned long MAX_BACKOFF_MS = 30000;
    static const uint32_t HEARTBEAT_INTERVAL_MS = 15000;

    static WsClient* _instance;
    static void staticEventHandler(WStype_t type, uint8_t* payload, size_t length);
    void handleEvent(WStype_t type, uint8_t* payload, size_t length);
};

#endif // !PDS_TRANSPORT_SERIAL
