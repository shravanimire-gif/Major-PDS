#pragma once
#include <Arduino.h>

// The USB serial transport: newline-delimited JSON out, single-letter commands
// in. Occupies the same role for the USB build that ws_client does for the
// WiFi build, which is why the two are shaped alike (begin / loop / send*).
//
// PROTOCOL — one JSON object per line, nothing else on the line
// ------------------------------------------------------------
//   -> {"type":"hello","deviceId":"ESP32-A1B2C3","firmware":"2.1.0-serial","transport":"serial","cellRatedGrams":5000,"calibrated":true}
//   -> {"type":"reading","grams":2487,"ts":81234}
//   -> {"type":"heartbeat","ts":86234}
//   -> {"type":"error","code":"OVERLOAD","detail":"5210 g exceeds 5000 g rating"}
//   -> {"type":"log","msg":"TARE COMPLETE"}
//
//   <- t          tare (zero the scale — remove all weight first)
//   <- c          guided calibration against 1000 g
//   <- c<grams>   guided calibration against a known reference weight, e.g. c1000
//   <- id         re-emit the hello frame
//
// `ts` is milliseconds since boot (millis()), NOT epoch. The board has no RTC
// and, in the USB build, no NTP — there is deliberately no network stack. The
// bridge stamps wall-clock time when it forwards a frame, which is both more
// accurate (the PC's clock is synced) and impossible for the device to lie
// about. See iot-bridge/src/serialParser.js.
//
// WHAT THIS PROTOCOL DOES NOT CARRY
// No session id, ration card, shop id, entitlement, wallet balance or
// authorisation of any kind. The board reports grams and hardware faults; every
// business decision belongs to the backend. A firmware that could name a
// session could dispense against a session that was never authorised.
//
// DEBUGGABILITY
// Every outbound line is a complete JSON object, so the whole protocol is
// readable in the Arduino Serial Monitor at 115200 with no tooling — which is
// the point: the same link is used for calibration by hand and for the bridge.
class SerialLink
{
public:
    void begin(unsigned long baud);

    // Emits the identity/capability frame. Sent once at boot and again on the
    // `id` command, so a bridge that attaches to an already-running board (or
    // reconnects after the ESP32 reset) can always ask "who are you?".
    void sendHello(bool calibrated, float calibrationFactor);

    void sendReading(int grams, unsigned long ms);
    void sendHeartbeat(unsigned long ms);
    void sendError(const char *code, const char *detail);
    void sendLog(const char *message);

    // Reads at most one complete newline-terminated command. Returns true and
    // fills `outCommand` when a line was available; returns false immediately
    // otherwise. Never blocks — the sample loop must keep running while the
    // operator is typing.
    bool readCommand(String &outCommand);

private:
    String _rxBuffer;
};
