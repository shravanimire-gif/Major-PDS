// In-memory pub-sub for dispense-session state-machine events, keyed by
// session_id. Same shape as services/liveReadingBus.js (Phase 1) but kept as
// a separate channel: liveReadingBus is shop-level raw readings for the
// admin tile, this is session-level state for the shopkeeper's own dispense
// screen — different audience, different key space.
// TODO: swap for Redis pub-sub (or another shared broker) if the backend
// ever runs as more than one instance.

const channels = new Map(); // sessionId -> { latest, subscribers: Set<fn> }

const getOrCreateChannel = (sessionId) => {
    let channel = channels.get(sessionId);
    if (!channel) {
        channel = { latest: null, subscribers: new Set() };
        channels.set(sessionId, channel);
    }
    return channel;
};

const publish = (sessionId, payload) => {
    const channel = getOrCreateChannel(sessionId);
    channel.latest = payload;
    for (const subscriber of channel.subscribers) {
        subscriber(payload);
    }
};

// Subscribes to a session's channel, immediately replaying the latest known
// payload (if any). Returns an unsubscribe function; unsubscribing the last
// listener removes the channel entirely (no-leak).
const subscribe = (sessionId, callback) => {
    const channel = getOrCreateChannel(sessionId);
    channel.subscribers.add(callback);

    if (channel.latest !== null) {
        callback(channel.latest);
    }

    return () => {
        channel.subscribers.delete(callback);
        if (channel.subscribers.size === 0) {
            channels.delete(sessionId);
        }
    };
};

const _subscriberCount = (sessionId) => channels.get(sessionId)?.subscribers.size || 0;

module.exports = { publish, subscribe, _subscriberCount };
