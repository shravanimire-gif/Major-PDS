// In-memory pub-sub for live IoT readings, keyed by shop_id. Deliberately
// in-process (no Redis) — a single backend instance is all Phase 1 needs.
// TODO: swap for Redis pub-sub (or another shared broker) if the backend
// ever runs as more than one instance, so all instances see every reading.

const channels = new Map(); // shopId -> { latest, subscribers: Set<fn> }

const getOrCreateChannel = (shopId) => {
    let channel = channels.get(shopId);
    if (!channel) {
        channel = { latest: null, subscribers: new Set() };
        channels.set(shopId, channel);
    }
    return channel;
};

const publish = (shopId, payload) => {
    const channel = getOrCreateChannel(shopId);
    channel.latest = payload;
    for (const subscriber of channel.subscribers) {
        subscriber(payload);
    }
};

// Subscribes to a shop's channel. Immediately replays the latest known
// payload (if any) so a freshly-opened admin tile isn't blank until the next
// reading arrives. Returns an unsubscribe function; unsubscribing the last
// listener on a channel removes the channel entirely (no-leak).
const subscribe = (shopId, callback) => {
    const channel = getOrCreateChannel(shopId);
    channel.subscribers.add(callback);

    if (channel.latest !== null) {
        callback(channel.latest);
    }

    return () => {
        channel.subscribers.delete(callback);
        if (channel.subscribers.size === 0) {
            channels.delete(shopId);
        }
    };
};

// Test/diagnostic helper — not used in normal request paths.
const _subscriberCount = (shopId) => channels.get(shopId)?.subscribers.size || 0;

module.exports = { publish, subscribe, _subscriberCount };
