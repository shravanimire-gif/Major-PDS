/**
 * serialParser.js
 *
 * Turns one line of ESP32 serial output into a logical message. Pure and
 * synchronous — no I/O, no state — which is what makes the whole protocol
 * layer unit-testable without a COM port or a board.
 *
 * WHY THREE INPUT FORMATS
 * The firmware in iot-device/ emits newline-delimited JSON, and that is the
 * format the rest of the system is built around. But the board is genuinely
 * useful before it is reflashed: a bare HX711 sketch (the "already working
 * through Arduino IDE" starting point) typically prints either `1234` or
 * `WEIGHT:1234`. Accepting those means the bridge can be pointed at the
 * existing sketch to prove the wiring, the COM port and the backend path all
 * work, and the firmware flash becomes an upgrade rather than a prerequisite.
 *
 * Formats, in the order they are tried:
 *   1. NDJSON     {"type":"reading","grams":2487,"ts":81234}   <- preferred
 *   2. Labelled   WEIGHT:2487   weight = 2487 g   Weight: 2487g
 *   3. Bare       2487   2487.4   -3
 *
 * Anything else (boot banners, ESP32 ROM messages, library chatter, partial
 * lines) is returned as `unparsed` and dropped by the caller with a debug log.
 * Returning a typed result rather than throwing keeps a noisy boot from being
 * indistinguishable from a protocol error.
 *
 * TIMESTAMPS
 * The device's `ts` is millis() since boot, not epoch — the USB build has no
 * RTC and no network. It is preserved as `deviceTs` for diagnostics, and the
 * PC's clock supplies the wall-clock time when the frame is forwarded. That is
 * both more accurate and not something the device can misreport.
 *
 * WHAT THIS DOES NOT DO
 * No entitlement, no wallet, no tolerance, no session, no authorisation. It
 * converts text to a number and labels it. Even the range check below is
 * deliberately narrow — see `MAX_ABSURD_GRAMS`.
 */

// Small negatives at rest are load-cell noise, not data — the firmware already
// floors them, and a bare sketch may not. Floored rather than rejected so an
// idle scale reads a steady 0 g instead of flickering between 0 and dropped.
const NOISE_FLOOR_GRAMS = -5;

// A guard against text that parsed as a number but cannot be a weight (a
// timestamp, a raw ADC count, a version number). Set far above the 5 kg cell
// rating ON PURPOSE:
//
// The backend rejects anything above MAX_VALID_GRAMS (5000 g) AND counts that
// rejection toward iot_devices.needs_recalibration. That counter is the
// system's only automatic signal that a cell has drifted or lost calibration.
// If the bridge quietly dropped 5200 g readings, the signal would never fire
// and a miscalibrated scale would look merely quiet. So genuinely-out-of-range
// weights are forwarded and rejected authoritatively, once, by the backend.
//
// This ceiling only filters values that are not plausibly a weight at all.
const MAX_ABSURD_GRAMS = 1_000_000;

const LABELLED_WEIGHT = /^[a-z_ ]*weight[a-z_ ]*[:=]?\s*(-?\d+(?:\.\d+)?)\s*(?:g|gram|grams)?$/i;
const BARE_NUMBER = /^(-?\d+(?:\.\d+)?)\s*(?:g|gram|grams)?$/i;

// RAW ADC COUNTS — recognised specifically in order to be REFUSED.
//
// The stock HX711 calibration sketches print lines like `Raw value: -26052.00`
// or `Reading: 4294901760`. Those are 24-bit ADC counts with no scale factor
// applied: the number is not grams, is not bounded by the cell's rating, and its
// sign depends on how A+/A- happen to be wired. A board still running one of
// these has not been calibrated.
//
// This pattern exists so the bridge can say *that*, rather than reporting the
// generic "not a recognised reading". It must never be promoted to a reading:
// forwarding -26052 as a weight, or a raw count that happened to land inside
// 0..5000, would put a fabricated measurement in front of the tolerance check —
// the one number in the whole system that has to be a real physical quantity.
const RAW_ADC_SKETCH = /^\s*(raw|adc)?\s*(value|reading|count)s?\s*[:=]\s*-?\d+(?:\.\d+)?\s*$/i;

const unparsed = (line, reason) => ({ type: "unparsed", reason, raw: line });

// Normalises a numeric weight into an integer gram reading, or explains why it
// isn't one.
const toReading = (rawGrams, line, deviceTs) => {
    // Type-checked before Number() rather than relying on it: Number(null) is 0
    // and Number(true) is 1, so a frame with a null/absent/boolean grams field
    // would otherwise arrive as a perfectly plausible 0 g or 1 g reading. A
    // missing measurement must be a dropped frame, never a zero one.
    if (typeof rawGrams !== "number" && typeof rawGrams !== "string") {
        return unparsed(line, "grams is missing or not a number");
    }
    if (typeof rawGrams === "string" && rawGrams.trim() === "") {
        return unparsed(line, "grams is empty");
    }

    const value = Number(rawGrams);

    if (!Number.isFinite(value)) {
        return unparsed(line, "grams is not a finite number");
    }
    if (Math.abs(value) > MAX_ABSURD_GRAMS) {
        return unparsed(line, "grams is implausible for a weight reading");
    }

    let grams = Math.round(value);
    if (grams < 0 && grams >= NOISE_FLOOR_GRAMS) {
        grams = 0;
    }

    // `deviceTs` is null for the labelled/bare formats, which carry no
    // timestamp at all. Checked for null explicitly because Number(null) is 0,
    // and a 0 here would read as "the board booted this instant".
    const parsedTs = deviceTs === null || deviceTs === undefined ? NaN : Number(deviceTs);

    return {
        type: "reading",
        grams,
        deviceTs: Number.isFinite(parsedTs) ? parsedTs : null,
        raw: line,
    };
};

const parseJsonFrame = (parsed, line) => {
    switch (parsed.type) {
        case "reading":
            return toReading(parsed.grams, line, parsed.ts);

        case "hello":
            return {
                type: "hello",
                // The device's self-reported identity. The bridge uses it as
                // the device_id it authenticates with, and cross-checks it
                // against IOT_DEVICE_ID when that is pinned — a board swap must
                // not silently inherit another device's shop assignment.
                deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId.trim() : null,
                firmware: typeof parsed.firmware === "string" ? parsed.firmware.trim() : null,
                transport: typeof parsed.transport === "string" ? parsed.transport : "serial",
                cellRatedGrams: Number.isFinite(Number(parsed.cellRatedGrams))
                    ? Number(parsed.cellRatedGrams)
                    : null,
                calibrated: parsed.calibrated === true,
                calibrationFactor: Number.isFinite(Number(parsed.calibrationFactor))
                    ? Number(parsed.calibrationFactor)
                    : null,
                raw: line,
            };

        case "heartbeat":
            return {
                type: "heartbeat",
                deviceTs: Number.isFinite(Number(parsed.ts)) ? Number(parsed.ts) : null,
                raw: line,
            };

        case "error":
            // Hardware fault codes only. Carries no grams field by design: a
            // fault reported as a number would be forwarded as a measurement.
            return {
                type: "error",
                code: typeof parsed.code === "string" ? parsed.code.slice(0, 40) : "UNKNOWN",
                detail: typeof parsed.detail === "string" ? parsed.detail.slice(0, 200) : null,
                raw: line,
            };

        case "log":
            return {
                type: "log",
                message: typeof parsed.msg === "string" ? parsed.msg : "",
                raw: line,
            };

        default:
            return unparsed(line, `unknown JSON frame type "${String(parsed.type).slice(0, 40)}"`);
    }
};

/**
 * @param {string} line One line of serial output, without its newline.
 * @returns {{type: 'reading'|'hello'|'heartbeat'|'error'|'log'|'unparsed', ...}}
 */
const parseSerialLine = (line) => {
    if (typeof line !== "string") {
        return unparsed(String(line), "not a string");
    }

    // Strip the NULs and control bytes an ESP32 emits while its UART settles
    // after a reset — without this, the first frame after every reboot arrives
    // with a leading \x00 and fails JSON.parse.
    const trimmed = line.replace(/[\x00-\x1f\x7f]/g, "").trim();

    if (trimmed.length === 0) {
        return unparsed(line, "empty line");
    }

    if (trimmed.startsWith("{")) {
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        } catch (err) {
            // A truncated line: the board reset mid-write, or the reader
            // attached partway through a frame. Common and harmless once.
            return unparsed(line, "looked like JSON but did not parse");
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return unparsed(line, "JSON was not an object");
        }
        return parseJsonFrame(parsed, line);
    }

    // Checked BEFORE the weight patterns: "Raw value: 1234" must be refused as a
    // raw count, not accepted as 1234 g by the bare-number fallback.
    if (RAW_ADC_SKETCH.test(trimmed)) {
        return unparsed(line, "raw ADC counts, not grams — this board is running an uncalibrated raw-value sketch");
    }

    const labelled = trimmed.match(LABELLED_WEIGHT);
    if (labelled) {
        return toReading(labelled[1], line, null);
    }

    const bare = trimmed.match(BARE_NUMBER);
    if (bare) {
        return toReading(bare[1], line, null);
    }

    return unparsed(line, "not a recognised reading or frame");
};

module.exports = {
    parseSerialLine,
    NOISE_FLOOR_GRAMS,
    MAX_ABSURD_GRAMS,
};
