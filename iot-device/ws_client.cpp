#include "ws_client.h"

WsClient* WsClient::_instance = nullptr;

void WsClient::begin(const char* host, uint16_t port, const char* path, const char* deviceId, const char* deviceToken) {
    _instance = this;

    // deviceId identifies which device is connecting (visible in the URL —
    // it isn't secret); deviceToken is the actual credential and travels in
    // the Sec-WebSocket-Protocol header instead, via the `protocol` arg below.
    _path = String(path) + "?deviceId=" + deviceId;

    _ws.onEvent(staticEventHandler);
    _ws.beginSSL(host, port, _path.c_str(), "", deviceToken);

    // Device-initiated heartbeat (ping every 15s). pds-backend also runs its
    // own independent stale-connection sweep (see iotSocketServer.js) in case
    // pings stop arriving entirely.
    _ws.enableHeartbeat(HEARTBEAT_INTERVAL_MS, 3000, 2);
}

void WsClient::loop() {
    _ws.loop();
}

void WsClient::staticEventHandler(WStype_t type, uint8_t* payload, size_t length) {
    if (_instance) {
        _instance->handleEvent(type, payload, length);
    }
}

void WsClient::handleEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_CONNECTED:
            Serial.println("[WS] Connected");
            _connected = true;
            _backoffMs = 1000; // reset exponential backoff after a successful connect
            break;

        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected");
            _connected = false;
            // Exponential backoff (1s, 2s, 4s, ... capped at 30s) applied to
            // the library's own reconnect timer.
            _ws.setReconnectInterval(_backoffMs);
            _backoffMs = min(_backoffMs * 2, MAX_BACKOFF_MS);
            break;

        case WStype_ERROR:
            Serial.printf("[WS] Error: %s\n", (payload && length) ? (const char*)payload : "(unknown)");
            break;

        default:
            break;
    }
}

void WsClient::sendReading(int grams, uint64_t epochMs) {
    if (!_connected) return;

    // {"type":"reading","grams":<int>,"ts":<epoch ms>,"sessionId":null}
    // sessionId is always null in Phase 1 (no session-gating yet — see
    // PHASE1_DONE.md). Matches pds-backend/src/validators/iot.js's
    // deviceReadingFrameSchema. Built with snprintf (not String
    // concatenation) since Arduino's String lacks a portable uint64_t
    // constructor across cores.
    char frame[128];
    snprintf(frame, sizeof(frame),
             "{\"type\":\"reading\",\"grams\":%d,\"ts\":%llu,\"sessionId\":null}",
             grams, (unsigned long long)epochMs);
    _ws.sendTXT(frame);
}
