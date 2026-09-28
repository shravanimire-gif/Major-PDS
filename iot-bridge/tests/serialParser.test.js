const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSerialLine, NOISE_FLOOR_GRAMS } = require("../src/serialParser");

// Uses node:test rather than jest deliberately. The bridge is a small
// dependency-light process; jest would be its largest dependency by an order of
// magnitude, installed to test four pure modules. node --test ships with Node.

test("serialParser — NDJSON reading frames (the firmware's own format)", async (t) => {
    await t.test("parses a well-formed reading", () => {
        const result = parseSerialLine('{"type":"reading","grams":2487,"ts":81234}');
        assert.equal(result.type, "reading");
        assert.equal(result.grams, 2487);
        assert.equal(result.deviceTs, 81234);
    });

    await t.test("rounds a fractional gram value to an integer", () => {
        // sensor_readings.grams_int and the backend's Joi schema are both
        // integer-only, so a float must not reach the wire.
        assert.equal(parseSerialLine('{"type":"reading","grams":2487.6}').grams, 2488);
    });

    await t.test("tolerates leading NULs from an ESP32 that just reset", () => {
        const result = parseSerialLine('\u0000\u0000{"type":"reading","grams":100,"ts":5}');
        assert.equal(result.type, "reading");
        assert.equal(result.grams, 100);
    });

    await t.test("drops a truncated frame instead of guessing", () => {
        const result = parseSerialLine('{"type":"reading","grams":24');
        assert.equal(result.type, "unparsed");
        assert.match(result.reason, /did not parse/);
    });

    await t.test("rejects a non-numeric grams value", () => {
        assert.equal(parseSerialLine('{"type":"reading","grams":"heavy"}').type, "unparsed");
    });

    await t.test("rejects null/NaN/Infinity grams", () => {
        assert.equal(parseSerialLine('{"type":"reading","grams":null}').type, "unparsed");
        assert.equal(parseSerialLine('{"type":"reading"}').type, "unparsed");
    });

    await t.test("rejects an unknown frame type rather than treating it as a reading", () => {
        const result = parseSerialLine('{"type":"dispense","grams":3000}');
        assert.equal(result.type, "unparsed");
        assert.match(result.reason, /unknown JSON frame type/);
    });

    await t.test("rejects a JSON array", () => {
        assert.equal(parseSerialLine("[1,2,3]").type, "unparsed");
    });
});

test("serialParser — hello / heartbeat / error / log frames", async (t) => {
    await t.test("extracts device identity and firmware from hello", () => {
        const result = parseSerialLine(
            '{"type":"hello","deviceId":"ESP32-A1B2C3","firmware":"2.0.0-serial","transport":"serial",' +
            '"cellRatedGrams":5000,"calibrated":true,"calibrationFactor":432.1}',
        );
        assert.equal(result.type, "hello");
        assert.equal(result.deviceId, "ESP32-A1B2C3");
        assert.equal(result.firmware, "2.0.0-serial");
        assert.equal(result.cellRatedGrams, 5000);
        assert.equal(result.calibrated, true);
        assert.equal(result.calibrationFactor, 432.1);
    });

    await t.test("treats a missing `calibrated` as not calibrated (fails closed)", () => {
        assert.equal(parseSerialLine('{"type":"hello","deviceId":"ESP32-1"}').calibrated, false);
    });

    await t.test("parses a heartbeat", () => {
        const result = parseSerialLine('{"type":"heartbeat","ts":86234}');
        assert.equal(result.type, "heartbeat");
        assert.equal(result.deviceTs, 86234);
    });

    await t.test("parses a hardware error and carries no grams value", () => {
        const result = parseSerialLine('{"type":"error","code":"OVERLOAD","detail":"5210 g exceeds 5000 g"}');
        assert.equal(result.type, "error");
        assert.equal(result.code, "OVERLOAD");
        assert.match(result.detail, /5210/);
        // Critical: an overload must never carry a number that could be
        // forwarded as a measurement.
        assert.equal(result.grams, undefined);
    });

    await t.test("ignores a grams field smuggled into an error frame", () => {
        const result = parseSerialLine('{"type":"error","code":"OVERLOAD","grams":3000}');
        assert.equal(result.type, "error");
        assert.equal(result.grams, undefined);
    });

    await t.test("parses a log line", () => {
        assert.equal(parseSerialLine('{"type":"log","msg":"Tared."}').message, "Tared.");
    });
});

test("serialParser — legacy/plain sketch output", async (t) => {
    await t.test("parses WEIGHT:1234", () => {
        assert.equal(parseSerialLine("WEIGHT:1234").grams, 1234);
    });

    await t.test("parses assorted labelled variants", () => {
        assert.equal(parseSerialLine("weight = 1234 g").grams, 1234);
        assert.equal(parseSerialLine("Weight: 1234g").grams, 1234);
        assert.equal(parseSerialLine("WEIGHT 1234").grams, 1234);
    });

    await t.test("parses teammate IoT setup serial format (Raw + Weight in g and kg)", () => {
        const line1 = "Raw: -27536    Weight: 0.0 g    0.000 kg";
        const line2 = "Raw: -387490    Weight: 1250.5 g    1.251 kg";
        assert.equal(parseSerialLine(line1).type, "reading");
        assert.equal(parseSerialLine(line1).grams, 0);
        assert.equal(parseSerialLine(line2).type, "reading");
        assert.equal(parseSerialLine(line2).grams, 1251);
    });


    await t.test("parses a bare number, with or without a unit suffix", () => {
        assert.equal(parseSerialLine("2487").grams, 2487);
        assert.equal(parseSerialLine("2487.4").grams, 2487);
        assert.equal(parseSerialLine("2487 g").grams, 2487);
    });

    await t.test("carries no deviceTs for formats that have no timestamp", () => {
        // Must be null, not 0 — a 0 would read as "the board booted this instant".
        assert.equal(parseSerialLine("2487").deviceTs, null);
    });

    await t.test("ignores ESP32 boot chatter", () => {
        for (const line of [
            "rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)",
            "ets Jul 29 2019 12:21:46",
            "[Boot] PDS IoT weighing device starting...",
            "configsip: 0, SPIWP:0xee",
            "",
            "   ",
        ]) {
            assert.equal(parseSerialLine(line).type, "unparsed", `expected unparsed: ${line}`);
        }
    });

    await t.test("REFUSES raw ADC counts from a stock HX711 calibration sketch", () => {
        // Observed verbatim on the real board before it was reflashed. These are
        // 24-bit ADC counts with no scale factor applied: not grams, not bounded
        // by the cell's rating, and the sign depends on how A+/A- are wired.
        // Recognised specifically so the bridge can name the misconfiguration —
        // and refused, because forwarding one as a weight would put a fabricated
        // measurement in front of the tolerance check.
        for (const line of ['Raw value: -26052.00', 'Raw value: -70894.00', 'Reading: 4294901760', 'raw value = 12', 'ADC count: 512']) {
            const result = parseSerialLine(line);
            assert.equal(result.type, 'unparsed', `must refuse: ${line}`);
            assert.match(result.reason, /raw ADC counts/);
        }
    });

    await t.test("does not let a raw-count line fall through to the bare-number parser", () => {
        // The danger is silent promotion: 'Raw value: 2487' must never become
        // 2487 g just because the number at the end looks plausible.
        const result = parseSerialLine('Raw value: 2487');
        assert.equal(result.type, 'unparsed');
        assert.equal(result.grams, undefined);
    });

    await t.test("still accepts a genuine labelled WEIGHT line", () => {
        // The raw-count guard must not swallow real weight output.
        assert.equal(parseSerialLine('Weight: 2487 g').grams, 2487);
        assert.equal(parseSerialLine('WEIGHT:2487').grams, 2487);
    });

    await t.test("rejects a non-string input without throwing", () => {
        assert.equal(parseSerialLine(undefined).type, "unparsed");
        assert.equal(parseSerialLine(42).type, "unparsed");
        assert.equal(parseSerialLine(null).type, "unparsed");
    });
});

test("serialParser — sensor value validation", async (t) => {
    await t.test("floors small negatives (load-cell noise at rest) to 0", () => {
        assert.equal(parseSerialLine("-1").grams, 0);
        assert.equal(parseSerialLine(String(NOISE_FLOOR_GRAMS)).grams, 0);
    });

    await t.test("preserves a large negative so the backend can reject and flag it", () => {
        // A sizeable negative means the cell is unplugged or wired backwards.
        // Passed through, NOT floored: the backend's rejection counter is what
        // sets needs_recalibration, and hiding it here would disable that signal.
        const result = parseSerialLine("-350");
        assert.equal(result.type, "reading");
        assert.equal(result.grams, -350);
    });

    await t.test("preserves an over-rating reading rather than swallowing it", () => {
        // 5200 g is above the 5 kg cell rating. The bridge forwards it so the
        // backend rejects it authoritatively and counts it toward
        // needs_recalibration — a silently dropped reading would look like quiet.
        const result = parseSerialLine('{"type":"reading","grams":5200}');
        assert.equal(result.type, "reading");
        assert.equal(result.grams, 5200);
    });

    await t.test("rejects a value that cannot be a weight at all", () => {
        // e.g. a raw ADC count or an epoch timestamp printed by mistake.
        assert.equal(parseSerialLine("1730000000000").type, "unparsed");
    });
});
