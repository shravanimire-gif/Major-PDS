// Tracks which IoT devices currently have a live /ws/iot connection, and any
// recalibration request queued for a device that's currently offline. A
// small shared singleton (same pattern as liveReadingBus.js/
// dispenseSessionBus.js) so ws/iotSocketServer.js (which owns the actual
// sockets) and the REST recalibrate endpoint (services/deviceFleetService.js,
// a completely different request context) can talk to each other without a
// direct reference to one another.

const connectedSockets = new Map(); // device_id -> ws
const pendingRecalibration = new Set(); // device_id

const registerConnection = (deviceId, ws) => {
    connectedSockets.set(deviceId, ws);
};

// Guards against a late/duplicate close event clobbering a *newer*
// connection for the same device_id that's already replaced this one.
const unregisterConnection = (deviceId, ws) => {
    if (connectedSockets.get(deviceId) === ws) {
        connectedSockets.delete(deviceId);
    }
};

const isOnline = (deviceId) => connectedSockets.has(deviceId);

// Drops a device's live socket, if it has one. Used when an admin action
// invalidates the authorisation the socket was opened under — reassigned to
// another shop, unassigned, disabled or revoked. The handshake already refuses
// such a device, but an already-open connection would otherwise keep streaming
// under the old row until it happened to reconnect on its own.
//
// close() (not terminate()) so the peer sees a clean close frame and the
// bridge's normal reconnect path runs; the bridge then re-authenticates and is
// either re-admitted against the new row or told 401.
const closeConnection = (deviceId, reason = "revoked") => {
    const ws = connectedSockets.get(deviceId);
    if (!ws) return false;
    try {
        ws.close(1008, reason); // 1008 = policy violation
    } catch (_) {
        // A socket already tearing down is exactly the outcome wanted here.
    }
    connectedSockets.delete(deviceId);
    return true;
};

// Pushes a recalibrate message immediately if the device is connected;
// otherwise queues it to be resent the next time the device connects.
// Never disconnects/terminates the device's existing connection — a
// recalibration reboot happens on the device's own next boot, not now.
const sendRecalibrate = (deviceId) => {
    const ws = connectedSockets.get(deviceId);
    if (ws && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "recalibrate" }));
        return true;
    }
    pendingRecalibration.add(deviceId);
    return false;
};

// Called by iotSocketServer.js right after a device connects — resends a
// queued recalibration request that was made while the device was offline.
const consumePendingRecalibration = (deviceId) => {
    if (pendingRecalibration.has(deviceId)) {
        pendingRecalibration.delete(deviceId);
        return true;
    }
    return false;
};

module.exports = {
    registerConnection,
    unregisterConnection,
    isOnline,
    closeConnection,
    sendRecalibrate,
    consumePendingRecalibration,
};
