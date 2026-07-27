const {
    evaluateNearTolerance,
    evaluateOffHours,
    evaluateRapidFire,
    evaluateDeviceAnomaly,
} = require("../src/services/anomalyRulesService");

describe("anomalyRulesService.evaluateNearTolerance", () => {
    const params = { edge_margin_grams: 10, window_days: 7, min_occurrences: 3 };

    it("fires when a shop has >= min_occurrences records near the low tolerance edge", () => {
        const records = Array.from({ length: 3 }, () => ({
            shop_id: "shop-a",
            measured_grams: 4955, // low edge = 5000-50=4950, within 10g
            entitled_grams: 5000,
            tolerance_grams: 50,
        }));
        const flags = evaluateNearTolerance(records, params);
        expect(flags).toHaveLength(1);
        expect(flags[0].shop_id).toBe("shop-a");
    });

    it("stays quiet when occurrences are below the threshold", () => {
        const records = [
            { shop_id: "shop-a", measured_grams: 4955, entitled_grams: 5000, tolerance_grams: 50 },
            { shop_id: "shop-a", measured_grams: 4955, entitled_grams: 5000, tolerance_grams: 50 },
        ];
        expect(evaluateNearTolerance(records, params)).toHaveLength(0);
    });

    it("stays quiet when measurements are comfortably within tolerance, not near the edge", () => {
        const records = Array.from({ length: 5 }, () => ({
            shop_id: "shop-a",
            measured_grams: 5000, // dead on target, far from the low edge
            entitled_grams: 5000,
            tolerance_grams: 50,
        }));
        expect(evaluateNearTolerance(records, params)).toHaveLength(0);
    });
});

describe("anomalyRulesService.evaluateOffHours", () => {
    const params = { start_hour: 7, end_hour: 21, timezone: "Asia/Kolkata" };

    it("fires for a commit outside the allowed hours (IST)", () => {
        // 2026-01-01T20:00:00Z = 2026-01-02T01:30 IST (UTC+5:30) -> off-hours
        const records = [{ id: "rec-1", shop_id: "shop-a", committed_at: "2026-01-01T20:00:00Z" }];
        const flags = evaluateOffHours(records, params);
        expect(flags).toHaveLength(1);
        expect(flags[0].dispense_record_id).toBe("rec-1");
    });

    it("stays quiet for a commit within allowed hours (IST)", () => {
        // 2026-01-01T06:00:00Z = 2026-01-01T11:30 IST -> within 07:00-21:00
        const records = [{ id: "rec-2", shop_id: "shop-a", committed_at: "2026-01-01T06:00:00Z" }];
        expect(evaluateOffHours(records, params)).toHaveLength(0);
    });
});

describe("anomalyRulesService.evaluateRapidFire", () => {
    const params = { max_commits_per_minute: 6 };

    it("fires when more than the limit commit within a 60s window", () => {
        const base = new Date("2026-01-01T10:00:00Z").getTime();
        const records = Array.from({ length: 7 }, (_, i) => ({
            shop_id: "shop-a",
            committed_at: new Date(base + i * 5000).toISOString(), // 7 commits in 30s
        }));
        const flags = evaluateRapidFire(records, params);
        expect(flags).toHaveLength(1);
        expect(flags[0].shop_id).toBe("shop-a");
    });

    it("stays quiet when commits are spread out", () => {
        const base = new Date("2026-01-01T10:00:00Z").getTime();
        const records = Array.from({ length: 5 }, (_, i) => ({
            shop_id: "shop-a",
            committed_at: new Date(base + i * 30_000).toISOString(), // 30s apart
        }));
        expect(evaluateRapidFire(records, params)).toHaveLength(0);
    });
});

describe("anomalyRulesService.evaluateDeviceAnomaly", () => {
    const params = { reject_pct_threshold: 5, window_hours: 24 };

    it("fires when a device's rejection rate exceeds the threshold", () => {
        const deviceStats = [{ device_id: "esp32-1", shop_id: "shop-a", total_readings: 90, rejected_readings: 10 }];
        const flags = evaluateDeviceAnomaly(deviceStats, params);
        expect(flags).toHaveLength(1);
        expect(flags[0].device_id).toBe("esp32-1");
    });

    it("stays quiet when the rejection rate is under the threshold", () => {
        const deviceStats = [{ device_id: "esp32-1", shop_id: "shop-a", total_readings: 199, rejected_readings: 1 }];
        expect(evaluateDeviceAnomaly(deviceStats, params)).toHaveLength(0);
    });

    it("ignores a device with zero total readings (no divide-by-zero)", () => {
        const deviceStats = [{ device_id: "esp32-1", shop_id: "shop-a", total_readings: 0, rejected_readings: 0 }];
        expect(evaluateDeviceAnomaly(deviceStats, params)).toHaveLength(0);
    });
});
