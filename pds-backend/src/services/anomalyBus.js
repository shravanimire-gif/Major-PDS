// A single global broadcast channel — unlike liveReadingBus.js/
// dispenseSessionBus.js (keyed by shop_id/session_id), the unresolved
// critical-flag count is a dashboard-wide figure every admin should see
// regardless of which shop they're looking at, so there's no key at all.

let latest = null;
const subscribers = new Set();

const publish = (payload) => {
    latest = payload;
    for (const subscriber of subscribers) {
        subscriber(payload);
    }
};

// Replays the latest known payload (if any) synchronously, same as the
// keyed buses, so a freshly-opened admin session isn't blank until the next
// anomaly-rules run.
const subscribe = (callback) => {
    subscribers.add(callback);
    if (latest !== null) {
        callback(latest);
    }
    return () => subscribers.delete(callback);
};

module.exports = { publish, subscribe };
