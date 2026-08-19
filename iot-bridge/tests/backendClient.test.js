const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { WebSocketServer } = require("ws");
const { BackendClient } = require("../src/backendClient");
const { buildWsUrl } = require("../src/config");

// Runs against a REAL WebSocket server on loopback rather than a mocked `ws`.
// The thing worth proving here is wire compatibility with pds-backend's
// handshake — the deviceId query parameter, the token in
// Sec-WebSocket-Protocol, the frame shapes — and a mock would only ever confirm
// the shape of the mock.

const DEVICE_TOKEN = "test-device-token-abcdef0123456789";

const baseConfig = (port) => ({
    backendUrl: `http://127.0.0.1:${port}`,
    backendWsPath: "/ws/iot",
    deviceToken: DEVICE_TOKEN,
    reconnectInitialMs: 25,
    reconnectMaxMs: 50,
    heartbeatMs: 40,
});

// Minimal stand-in for the backend's /ws/iot endpoint: it records the handshake
// and every frame, and can be told to reject the next handshake with a 401.
const startFakeBackend = async ({ rejectWith = null } = {}) => {
    // rejectWith lives on `state` so a test can clear it mid-run (simulating an
    // admin registering/assigning the device) and watch the next retry succeed.
    const state = { handshakes: [], frames: [], connections: 0, sockets: [], rejectWith };
    const server = http.createServer();
    const wss = new WebSocketServer({ noServer: true });

    wss.on("connection", (ws) => {
        state.connections += 1;
        state.sockets.push(ws);
        ws.on("message", (raw) => {
            try {
                state.frames.push(JSON.parse(raw.toString()));
            } catch (_) {
                state.frames.push({ type: "<unparseable>", raw: raw.toString() });
            }
        });
    });

    server.on("upgrade", (req, socket, head) => {
        state.handshakes.push({
            url: req.url,
            subprotocol: req.headers["sec-websocket-protocol"] || null,
        });

        if (state.rejectWith) {
            socket.write(`HTTP/1.1 ${state.rejectWith} Unauthorized\r\n\r\n`);
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    state.port = server.address().port;
    state.close = () =>
        new Promise((resolve) => {
            state.sockets.forEach((ws) => {
                try {
                    ws.terminate();
                } catch (_) {
                    /* already gone */
                }
            });
            wss.close(() => server.close(resolve));
        });
    return state;
};

const waitFor = async (predicate, { timeoutMs = 3000, label = "condition" } = {}) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${label}`);
};

test("buildWsUrl", async (t) => {
    await t.test("converts http to ws and appends the deviceId", () => {
        const url = buildWsUrl("ESP32-A1B2C3", { backendUrl: "http://localhost:5055", backendWsPath: "/ws/iot" });
        assert.equal(url, "ws://localhost:5055/ws/iot?deviceId=ESP32-A1B2C3");
    });

    await t.test("converts https to wss", () => {
        const url = buildWsUrl("ESP32-1", { backendUrl: "https://pds.example.gov", backendWsPath: "/ws/iot" });
        assert.match(url, /^wss:\/\//);
    });

    await t.test("tolerates a trailing slash on the backend URL", () => {
        const url = buildWsUrl("ESP32-1", { backendUrl: "http://localhost:5055/", backendWsPath: "/ws/iot" });
        assert.equal(url, "ws://localhost:5055/ws/iot?deviceId=ESP32-1");
    });

    await t.test("never places the device token in the URL", () => {
        // URLs end up in logs, proxy records and process listings. The
        // credential travels in Sec-WebSocket-Protocol instead.
        const url = buildWsUrl("ESP32-1", {
            backendUrl: "http://localhost:5055",
            backendWsPath: "/ws/iot",
            deviceToken: DEVICE_TOKEN,
        });
        assert.equal(url.includes(DEVICE_TOKEN), false);
    });

    await t.test("url-encodes a device id containing reserved characters", () => {
        const url = buildWsUrl("ESP32 A&B", { backendUrl: "http://x", backendWsPath: "/ws/iot" });
        assert.equal(url, "ws://x/ws/iot?deviceId=ESP32%20A%26B");
    });
});

test("BackendClient speaks the existing /ws/iot device protocol", async (t) => {
    const backend = await startFakeBackend();
    const client = new BackendClient(baseConfig(backend.port));

    t.after(async () => {
        client.stop();
        await backend.close();
    });

    client.start("ESP32-A1B2C3", "2.0.0-serial");
    await waitFor(() => client.connected, { label: "connection" });

    await t.test("presents deviceId in the URL and the token as the subprotocol", () => {
        const handshake = backend.handshakes[0];
        assert.match(handshake.url, /^\/ws\/iot\?deviceId=ESP32-A1B2C3$/);
        assert.equal(handshake.subprotocol, DEVICE_TOKEN);
        // The credential must not also be in the URL.
        assert.equal(handshake.url.includes(DEVICE_TOKEN), false);
    });

    await t.test("sends a hello frame carrying the firmware version and no business fields", async () => {
        await waitFor(() => backend.frames.some((f) => f.type === "hello"), { label: "hello frame" });
        const hello = backend.frames.find((f) => f.type === "hello");
        assert.equal(hello.deviceId, "ESP32-A1B2C3");
        assert.equal(hello.firmware, "2.0.0-serial");
        assert.equal(hello.transport, "serial");

        // A device may not assert any of these — the backend derives shop from
        // the registered device row and session from dispense_sessions.
        for (const forbidden of [
            "sessionId",
            "shopId",
            "shop_id",
            "rationCardId",
            "ration_card_id",
            "entitledGrams",
            "entitled_grams",
            "walletBalance",
        ]) {
            assert.equal(forbidden in hello, false, `hello must not carry ${forbidden}`);
        }
    });

    await t.test("sends readings with an epoch ts from the PC clock", async () => {
        const before = Date.now();
        assert.equal(client.sendReading(2487), true);
        await waitFor(() => backend.frames.some((f) => f.type === "reading"), { label: "reading frame" });

        const reading = backend.frames.find((f) => f.type === "reading");
        assert.equal(reading.grams, 2487);
        // The board's millis() is not epoch time; the PC's clock is the only
        // correct source, and it is one the device cannot misreport.
        assert.ok(reading.ts >= before && reading.ts <= Date.now() + 1000);
        assert.equal("sessionId" in reading, false);
    });

    await t.test("counts forwarded readings", () => {
        assert.equal(client.describe().readingsForwarded, 1);
        assert.equal(client.describe().readingsDropped, 0);
    });

    await t.test("sends periodic heartbeats so the backend's idle sweep is satisfied", async () => {
        await waitFor(() => backend.frames.filter((f) => f.type === "heartbeat").length >= 2, {
            label: "two heartbeats",
        });
        const heartbeat = backend.frames.find((f) => f.type === "heartbeat");
        assert.ok(Number.isInteger(heartbeat.ts));
    });

    await t.test("relays a hardware fault with a code but no grams value", async () => {
        client.sendDeviceError("OVERLOAD", "5210 g exceeds 5000 g");
        await waitFor(() => backend.frames.some((f) => f.type === "error"), { label: "error frame" });
        const error = backend.frames.find((f) => f.type === "error");
        assert.equal(error.code, "OVERLOAD");
        assert.equal("grams" in error, false);
    });

    await t.test("does not leak the token in describe()", () => {
        assert.equal(JSON.stringify(client.describe()).includes(DEVICE_TOKEN), false);
    });
});

test("BackendClient — backend disconnect and recovery", async (t) => {
    const backend = await startFakeBackend();
    const client = new BackendClient(baseConfig(backend.port));

    t.after(async () => {
        client.stop();
        await backend.close();
    });

    client.start("ESP32-RECONNECT", "1.0.0");
    await waitFor(() => client.connected, { label: "first connection" });
    assert.equal(backend.connections, 1);

    // The backend restarted / dropped the socket.
    backend.sockets.forEach((ws) => ws.terminate());
    await waitFor(() => !client.connected, { label: "disconnect to be noticed" });

    await t.test("drops readings while disconnected instead of queueing stale weights", () => {
        assert.equal(client.sendReading(1234), false);
        assert.equal(client.describe().readingsDropped >= 1, true);
    });

    await t.test("reconnects automatically", async () => {
        await waitFor(() => client.connected, { timeoutMs: 5000, label: "reconnect" });
        assert.ok(backend.connections >= 2);
    });

    await t.test("re-sends hello on the new connection", async () => {
        await waitFor(() => backend.frames.filter((f) => f.type === "hello").length >= 2, {
            label: "second hello",
        });
    });

    await t.test("resets the backoff after a successful reconnect", () => {
        // Otherwise a flapping link would climb to the 30 s cap and stay there,
        // making the next genuine recovery look like a hang.
        assert.equal(client.backoffMs, client.config.reconnectInitialMs);
    });
});

test("BackendClient — rejected handshake keeps retrying without crashing", async (t) => {
    const backend = await startFakeBackend({ rejectWith: 401 });
    const client = new BackendClient(baseConfig(backend.port));

    t.after(async () => {
        client.stop();
        await backend.close();
    });

    let sawError = false;
    client.on("socket-error", () => {
        sawError = true;
    });

    client.start("ESP32-UNREGISTERED", "1.0.0");

    // A 401 is a normal state during setup (device not yet registered, or not
    // yet assigned to a shop), and an admin may fix it at any moment — so the
    // bridge must survive it and keep trying rather than exit.
    await waitFor(() => sawError, { label: "401 to be surfaced" });
    assert.equal(client.connected, false);
    await waitFor(() => backend.handshakes.length >= 2, { timeoutMs: 5000, label: "a retry" });

    // Once the admin assigns the device, the very next retry succeeds with no
    // bridge restart.
    backend.rejectWith = null;
    await waitFor(() => client.connected, { timeoutMs: 5000, label: "recovery after assignment" });
});

test("BackendClient — unreachable backend does not crash the bridge", async (t) => {
    // Port 1 is reserved and never listening: stands in for "npm run dev isn't
    // running yet", which is how most demos start.
    const client = new BackendClient({ ...baseConfig(1), reconnectMaxMs: 30 });
    t.after(() => client.stop());

    let errors = 0;
    client.on("socket-error", () => {
        errors += 1;
    });

    client.start("ESP32-NOBACKEND", "1.0.0");
    await waitFor(() => errors >= 2, { timeoutMs: 5000, label: "repeated connection failures" });
    assert.equal(client.connected, false);
});

test("BackendClient — stop() is idempotent and releases timers", async () => {
    const backend = await startFakeBackend();
    const client = new BackendClient(baseConfig(backend.port));
    client.start("ESP32-STOP", "1.0.0");
    await waitFor(() => client.connected, { label: "connection" });

    client.stop();
    client.stop(); // must not throw

    assert.equal(client.connected, false);
    assert.equal(client.heartbeatTimer, null);
    assert.equal(client.reconnectTimer, null);
    assert.equal(client.sendReading(100), false);

    await backend.close();
});
