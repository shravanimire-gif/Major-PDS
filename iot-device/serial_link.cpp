#include "serial_link.h"
#include "pds_config.h"
#include "device_identity.h"

void SerialLink::begin(unsigned long baud) {
    Serial.begin(baud);
    delay(200); // let the USB CDC endpoint come up before the first line
}

void SerialLink::sendHello(bool calibrated, float calibrationFactor) {
    // Built with printf rather than a JSON library: one object, fixed shape, no
    // dependency to install, and the output stays byte-for-byte predictable —
    // which is what makes it safe to parse with a plain JSON.parse on the other
    // end and readable in the Serial Monitor.
    Serial.printf(
        "{\"type\":\"hello\",\"deviceId\":\"%s\",\"firmware\":\"%s\",\"transport\":\"serial\","
        "\"cellRatedGrams\":%d,\"calibrated\":%s,\"calibrationFactor\":%.4f}\n",
        pdsDeviceId(),
        PDS_FIRMWARE_VERSION,
        PDS_LOAD_CELL_RATED_GRAMS,
        calibrated ? "true" : "false",
        calibrationFactor);
}

void SerialLink::sendReading(int grams, unsigned long ms) {
    Serial.printf("{\"type\":\"reading\",\"grams\":%d,\"ts\":%lu}\n", grams, ms);
}

void SerialLink::sendHeartbeat(unsigned long ms) {
    Serial.printf("{\"type\":\"heartbeat\",\"ts\":%lu}\n", ms);
}

void SerialLink::sendError(const char* code, const char* detail) {
    // No grams field, ever. An overload reported as a number would be
    // indistinguishable from a measurement, and a 4000 g "overload" would
    // fabricate a perfect dispense out of a hardware fault.
    if (detail && detail[0] != '\0') {
        Serial.printf("{\"type\":\"error\",\"code\":\"%s\",\"detail\":\"%s\"}\n", code, detail);
    } else {
        Serial.printf("{\"type\":\"error\",\"code\":\"%s\"}\n", code);
    }
}

void SerialLink::sendLog(const char* message) {
    Serial.printf("{\"type\":\"log\",\"msg\":\"%s\"}\n", message);
}

bool SerialLink::readCommand(String& outCommand) {
    // Accumulates bytes across loop iterations rather than using
    // Serial.readStringUntil('\n'), which blocks for up to the stream timeout
    // (1 s by default) on a partially-typed line. At 10 Hz sampling, a blocking
    // read would drop ~10 readings every time the operator paused mid-command.
    while (Serial.available()) {
        const char c = (char)Serial.read();

        if (c == '\n' || c == '\r') {
            if (_rxBuffer.length() == 0) {
                continue; // bare CR/LF, or the LF of a CRLF pair
            }
            outCommand = _rxBuffer;
            outCommand.trim();
            _rxBuffer = "";
            return outCommand.length() > 0;
        }

        // Bounded so a peer that never sends a newline cannot grow this without
        // limit. 64 bytes is far more than the longest legal command ("c5000").
        if (_rxBuffer.length() < 64) {
            _rxBuffer += c;
        }
    }

    return false;
}
