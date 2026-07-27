const { buildRowHash } = require("../src/services/chainRowBuilder");

const SAMPLE_FIELDS = {
    sessionId: "11111111-1111-1111-1111-111111111111",
    rationCardId: "22222222-2222-2222-2222-222222222222",
    shopId: "33333333-3333-3333-3333-333333333333",
    commodity: "rice",
    entitledGrams: 5000,
    measuredGrams: 5012,
};

describe("chainRowBuilder.buildRowHash", () => {
    it("is reproducible for the same prevHash + fields", () => {
        const a = buildRowHash("prev-hash-abc", SAMPLE_FIELDS);
        const b = buildRowHash("prev-hash-abc", { ...SAMPLE_FIELDS });
        expect(a).toBe(b);
    });

    it("is independent of key insertion order", () => {
        const reordered = {
            measuredGrams: SAMPLE_FIELDS.measuredGrams,
            commodity: SAMPLE_FIELDS.commodity,
            entitledGrams: SAMPLE_FIELDS.entitledGrams,
            shopId: SAMPLE_FIELDS.shopId,
            rationCardId: SAMPLE_FIELDS.rationCardId,
            sessionId: SAMPLE_FIELDS.sessionId,
        };
        expect(buildRowHash("prev-hash-abc", reordered)).toBe(buildRowHash("prev-hash-abc", SAMPLE_FIELDS));
    });

    it("changes when prevHash changes", () => {
        const a = buildRowHash("prev-hash-abc", SAMPLE_FIELDS);
        const b = buildRowHash("prev-hash-xyz", SAMPLE_FIELDS);
        expect(a).not.toBe(b);
    });

    it("changes when any field changes", () => {
        const a = buildRowHash("prev-hash-abc", SAMPLE_FIELDS);
        const b = buildRowHash("prev-hash-abc", { ...SAMPLE_FIELDS, measuredGrams: 5013 });
        expect(a).not.toBe(b);
    });

    it("treats a null/undefined prevHash as the empty string (first record in a chain)", () => {
        expect(buildRowHash(null, SAMPLE_FIELDS)).toBe(buildRowHash("", SAMPLE_FIELDS));
        expect(buildRowHash(undefined, SAMPLE_FIELDS)).toBe(buildRowHash("", SAMPLE_FIELDS));
    });

    it("produces a 64-char lowercase hex sha256 digest", () => {
        const hash = buildRowHash("prev-hash-abc", SAMPLE_FIELDS);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
});
