const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { Bridge } = require("../src/bridge");

// Fakes for both collaborators, so the orchestration is verified with no COM
// port, no board and no running backend — including the paths that are
// impossible to stage by hand (a swapped board reporting a different UID).

class FakeSource extends EventEmitter {
    constructor() {
        super();
        this.open = false;
        this.started = false;
        this.stopped = false;
        this.written = [];
    }
    start() {
        this.started = true;
        this.open = true;
        this.emit("open", { path: "COM5", baud: 115200, port: { chip: "test" } });
    }
    stop() {
        this.stopped = true;
        this.open = false;
    }
    write(line) {
        this.written.push(line);
        return true;
    }
    describe() {
        return { open: this.open, path: "COM5", baud: 115200 };
    }
    // Test helpers
    emitLine(message) {
        this.emit("message", message);
    }
    disconnect() {
        this.open = false;
        this.emit("closed", { path: "COM5" });
    }
}

class FakeClient extends EventEmitter {
    constructor() {
        super();
        this.connected = false;
        this.startCalls = [];
        this.stopCalls = 0;
        this.readings = [];
        this.heartbeats = 0;
        this.deviceErrors = [];
        this.firmwareAnnouncements = [];
        this.firmware = null;
    }
    start(deviceId, firmware) {
        this.startCalls.push({ deviceId, firmware });
        this.connected = true;
    }
    stop() {
        this.stopCalls += 1;
        this.connected = false;
    }
    sendReading(grams) {
        if (!this.connected) return false;
        this.readings.push(grams);
        return true;
    }
    sendHeartbeat() {
        this.heartbeats += 1;
        return true;
    }
    announceFirmware(firmware) {
        this.firmwareAnnouncements.push(firmware);
        this.firmware = firmware;
        return this.connected;
    }
    sendDeviceError(code, detail) {
        this.deviceErrors.push({ code, detail });
        return true;
    }
    describe() {
        return { connected: this.connected, readingsForwarded: this.readings.length, readingsDropped: 0 };
    }
}

const CONFIG = {
    deviceId: null,
    backendUrl: "http://localhost:5055",
    backendWsPath: "/ws/iot",
    HARDWARE_MAX_GRAMS: 5000,
    reconnectInitialMs: 10,
    reconnectMaxMs: 20,
    heartbeatMs: 50,
};

const makeBridge = (overrides = {}) => {
    const source = new FakeSource();
    const client = new FakeClient();
    const bridge = new Bridge({ config: { ...CONFIG, ...overrides }, source, client });
    return { bridge, source, client };
};

const HELLO = {
    type: "hello",
    deviceId: "ESP32-A1B2C3",
    firmware: "2.0.0-serial",
    transport: "serial",
    cellRatedGrams: 5000,
    calibrated: true,
};

test("bridge — identity handshake", async (t) => {
    await t.test("waits for the device's hello before connecting to the backend", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();

        // No device_id yet: connecting now would have to invent one, and a
        // guessed identity authenticates as the wrong device.
        assert.equal(client.startCalls.length, 0);
        assert.equal(bridge.describe().bridge.status, "waiting_for_identity");

        source.emitLine(HELLO);
        assert.equal(client.startCalls.length, 1);
        assert.deepEqual(client.startCalls[0], { deviceId: "ESP32-A1B2C3", firmware: "2.0.0-serial" });
    });

    await t.test("connects immediately when IOT_DEVICE_ID is pinned", () => {
        const { bridge, client } = makeBridge({ deviceId: "ESP32-PINNED" });
        bridge.start();
        assert.equal(client.startCalls.length, 1);
        assert.equal(client.startCalls[0].deviceId, "ESP32-PINNED");
    });

    await t.test("ignores a hello with no deviceId", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine({ type: "hello", deviceId: null, firmware: "x" });
        assert.equal(client.startCalls.length, 0);
    });

    await t.test("pushes the firmware version even when the socket opened first", () => {
        // With IOT_DEVICE_ID pinned the bridge connects before the board has said
        // anything, so the first hello necessarily carries a null firmware. Without
        // a follow-up announce, iot_devices.firmware_version would stay NULL for
        // exactly the setup that pins a device.
        const { bridge, source, client } = makeBridge({ deviceId: "ESP32-A1B2C3" });
        bridge.start();
        assert.equal(client.startCalls[0].firmware, null);

        source.emitLine(HELLO);
        assert.deepEqual(client.firmwareAnnouncements, ["2.0.0-serial"]);
    });

    await t.test("does not re-announce an unchanged firmware version", () => {
        const { bridge, source, client } = makeBridge({ deviceId: "ESP32-A1B2C3" });
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine(HELLO);
        source.emitLine(HELLO);
        assert.equal(client.firmwareAnnouncements.length, 1);
    });

    await t.test("does not open a second backend connection when the board re-announces", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine(HELLO);
        source.emitLine(HELLO);
        assert.equal(client.startCalls.length, 1);
    });

    await t.test("reconnects when the board re-announces while the backend is down", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        client.connected = false; // backend dropped
        source.emitLine(HELLO); // ESP32 reset and said hello again
        assert.equal(client.startCalls.length, 2);
    });
});

test("bridge — pinned UID mismatch is a hard stop", async (t) => {
    await t.test("refuses to forward readings from a board with the wrong UID", () => {
        const { bridge, source, client } = makeBridge({ deviceId: "ESP32-EXPECTED" });
        bridge.start();
        assert.equal(client.startCalls.length, 1); // optimistic connect on the pinned id

        source.emitLine({ ...HELLO, deviceId: "ESP32-DIFFERENT" });

        // Continuing would authenticate a physically different scale using the
        // pinned device's token, binding the wrong hardware to that device's
        // shop and sessions.
        assert.equal(client.stopCalls, 1);
        assert.equal(bridge.deviceId, null);
        assert.equal(bridge.describe().bridge.status, "identity_mismatch");
        assert.deepEqual(bridge.identityMismatch, {
            expected: "ESP32-EXPECTED",
            reported: "ESP32-DIFFERENT",
        });

        client.connected = false;
        source.emitLine({ type: "reading", grams: 3000, deviceTs: 1 });
        assert.equal(client.readings.length, 0);
    });

    await t.test("accepts a matching UID and clears any prior mismatch", () => {
        const { bridge, source } = makeBridge({ deviceId: "ESP32-A1B2C3" });
        bridge.start();
        source.emitLine(HELLO);
        assert.equal(bridge.identityMismatch, null);
        assert.equal(bridge.deviceId, "ESP32-A1B2C3");
    });
});

test("bridge — reading relay", async (t) => {
    await t.test("forwards a reading once identity is known", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine({ type: "reading", grams: 2487, deviceTs: 1000 });
        assert.deepEqual(client.readings, [2487]);
    });

    await t.test("drops readings that arrive before identity rather than buffering them", () => {
        // There is no device to attribute them to, and attributing them to a
        // guess would put one board's weights under another board's shop.
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine({ type: "reading", grams: 2487, deviceTs: 1 });
        assert.equal(client.readings.length, 0);
    });

    await t.test("forwards an over-rating reading so the backend can reject and flag it", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine({ type: "reading", grams: 5200, deviceTs: 1 });
        // Swallowing it would disable iot_devices.needs_recalibration, which is
        // the only automatic signal that a cell has lost calibration.
        assert.deepEqual(client.readings, [5200]);
    });

    await t.test("records the latest reading for the health endpoint without acting on it", () => {
        const { bridge, source } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine({ type: "reading", grams: 1234, deviceTs: 1 });
        const snapshot = bridge.describe();
        assert.equal(snapshot.reading.lastGrams, 1234);
        assert.ok(snapshot.reading.lastAt);
    });
});

test("bridge — hardware faults and device logs", async (t) => {
    await t.test("relays a hardware fault as an error frame, never as a weight", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine({ type: "error", code: "OVERLOAD", detail: "5210 g exceeds 5000 g" });

        assert.equal(client.deviceErrors.length, 1);
        assert.equal(client.deviceErrors[0].code, "OVERLOAD");
        // An overload must not become a measurement.
        assert.equal(client.readings.length, 0);
        assert.equal(bridge.describe().reading.lastDeviceError.code, "OVERLOAD");
    });

    await t.test("does not relay a fault before identity is known", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine({ type: "error", code: "SENSOR_FAULT", detail: "cell unplugged" });
        assert.equal(client.deviceErrors.length, 0);
    });

    await t.test("does not treat a device log line as a reading", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine({ type: "log", message: "Tared." });
        assert.equal(client.readings.length, 0);
    });

    await t.test("ignores an unknown message type without throwing", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.emitLine({ type: "something-new", grams: 9999 });
        assert.equal(client.readings.length, 0);
    });
});

test("bridge — disconnect handling", async (t) => {
    await t.test("keeps the backend connection open across a brief serial drop", () => {
        // Holding the socket is what lets an ESP32 reset recover without a
        // visible outage; the backend's own idle sweep decides when a device is
        // genuinely offline, which is the authoritative place for that call.
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        source.disconnect();
        assert.equal(client.stopCalls, 0);
        assert.equal(bridge.describe().bridge.status, "waiting_for_device");
    });

    await t.test("stops forwarding while the backend socket is down, without queueing", () => {
        // A weight is only meaningful when it was measured; replaying a stale
        // one into a live session would feed the stability detector a value
        // that no longer describes what is on the pan.
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        client.connected = false;
        source.emitLine({ type: "reading", grams: 2000, deviceTs: 1 });
        assert.equal(client.readings.length, 0);

        client.connected = true;
        source.emitLine({ type: "reading", grams: 2100, deviceTs: 2 });
        assert.deepEqual(client.readings, [2100]);
    });

    await t.test("stop() releases both the port and the backend connection", () => {
        const { bridge, source, client } = makeBridge();
        bridge.start();
        source.emitLine(HELLO);
        bridge.stop();
        assert.equal(source.stopped, true);
        assert.equal(client.stopCalls, 1);
    });
});

test("bridge — health snapshot never leaks a credential", () => {
    const { bridge, source } = makeBridge({ deviceToken: "super-secret-token-value" });
    bridge.start();
    source.emitLine(HELLO);

    const serialised = JSON.stringify(bridge.describe());
    assert.equal(serialised.includes("super-secret-token-value"), false);
    assert.equal(serialised.includes("deviceToken"), false);
});

test("bridge — status progression", () => {
    const { bridge, source, client } = makeBridge();

    // Before start: nothing is open.
    assert.equal(bridge.describe().bridge.status, "waiting_for_device");

    bridge.start();
    assert.equal(bridge.describe().bridge.status, "waiting_for_identity");

    client.connected = false;
    source.emitLine(HELLO);
    client.connected = false; // simulate the socket not yet established
    assert.equal(bridge.describe().bridge.status, "waiting_for_backend");

    client.connected = true;
    assert.equal(bridge.describe().bridge.status, "online");
});
