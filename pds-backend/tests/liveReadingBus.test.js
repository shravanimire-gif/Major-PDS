const liveReadingBus = require("../src/services/liveReadingBus");

describe("liveReadingBus", () => {
    it("delivers a published payload to a subscriber", () => {
        const received = [];
        const unsubscribe = liveReadingBus.subscribe("shop-a", (payload) => received.push(payload));

        liveReadingBus.publish("shop-a", { type: "reading", gramsInt: 100 });

        expect(received).toEqual([{ type: "reading", gramsInt: 100 }]);
        unsubscribe();
    });

    it("replays the latest payload to a new subscriber", () => {
        liveReadingBus.publish("shop-b", { type: "reading", gramsInt: 250 });

        const received = [];
        const unsubscribe = liveReadingBus.subscribe("shop-b", (payload) => received.push(payload));

        expect(received).toEqual([{ type: "reading", gramsInt: 250 }]);
        unsubscribe();
    });

    it("stops delivering payloads after unsubscribe", () => {
        const received = [];
        const unsubscribe = liveReadingBus.subscribe("shop-c", (payload) => received.push(payload));
        unsubscribe();

        liveReadingBus.publish("shop-c", { type: "reading", gramsInt: 500 });

        expect(received).toEqual([]);
    });

    it("does not leak subscribers after everyone unsubscribes", () => {
        const unsubscribeA = liveReadingBus.subscribe("shop-d", () => {});
        const unsubscribeB = liveReadingBus.subscribe("shop-d", () => {});

        expect(liveReadingBus._subscriberCount("shop-d")).toBe(2);

        unsubscribeA();
        expect(liveReadingBus._subscriberCount("shop-d")).toBe(1);

        unsubscribeB();
        expect(liveReadingBus._subscriberCount("shop-d")).toBe(0);
    });

    it("only notifies subscribers of the matching shopId", () => {
        const receivedX = [];
        const receivedY = [];
        const unsubscribeX = liveReadingBus.subscribe("shop-x", (payload) => receivedX.push(payload));
        const unsubscribeY = liveReadingBus.subscribe("shop-y", (payload) => receivedY.push(payload));

        liveReadingBus.publish("shop-x", { type: "reading", gramsInt: 42 });

        expect(receivedX).toEqual([{ type: "reading", gramsInt: 42 }]);
        expect(receivedY).toEqual([]);

        unsubscribeX();
        unsubscribeY();
    });
});
