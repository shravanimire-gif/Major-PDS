const crypto = require("crypto");

// Deterministic stringify: object keys are sorted recursively so the same
// logical fields always canonicalize to the same string regardless of the
// order they were constructed in — required for row_hash to be reproducible.
const canonicalJson = (value) => {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(",")}]`;
    }
    if (value && typeof value === "object") {
        const keys = Object.keys(value).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
};

// row_hash = sha256(prevHash || canonical_json(fields)) — a per-shop hash
// chain over dispense_records (see migrations/010_create_dispense_records.js
// and dispenseSessionService.commitSession). prevHash is null/empty for the
// first record in a shop's chain.
const buildRowHash = (prevHash, fields) => {
    const canonical = canonicalJson(fields);
    return crypto.createHash("sha256").update(`${prevHash || ""}${canonical}`).digest("hex");
};

module.exports = { buildRowHash, canonicalJson };
