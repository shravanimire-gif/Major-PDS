const {
    MAX_DISPENSE_TRANSACTION_GRAMS,
    ALLOCATION_GRAMS_STEP,
} = require("../config/allocation");

/**
 * allocationPolicyService.js
 *
 * The single authoritative place that turns a category policy into an
 * allocation, and the single place that decides whether an allocation is
 * legal. Every caller that funds a wallet or opens an IoT session goes
 * through here — entitlementService (monthly cron), adminController (card
 * creation, bulk upload, adding a family member) and dispenseSessionService
 * (IoT session) — so the invariant is stated once, not re-derived per service.
 *
 * ALLOCATION MODEL
 * ----------------
 * Allocation is PER RATION CARD (per household), per commodity, per month:
 *
 *     policies.rice_per_card_grams   -> the card's whole rice allocation
 *     policies.wheat_per_card_grams  -> the card's whole wheat allocation
 *
 * It is deliberately NOT per-person. A per-person policy multiplied by an
 * unbounded family size cannot be bounded by anything except a clamp, and a
 * clamp would mean the system authorises grain it cannot dispense in one
 * transaction. Denominating the policy per card makes the ceiling structural:
 * the policy table physically cannot hold a value above
 * MAX_DISPENSE_TRANSACTION_GRAMS (CHECK constraints, migration 023), so no
 * arithmetic anywhere can produce an over-large allocation. Category
 * differentiation is preserved — each category carries its own per-commodity
 * figure.
 *
 * Rice and wheat are independent: the ceiling applies to each commodity
 * separately, because a dispense_session covers exactly one commodity
 * (dispense_sessions.commodity is single-valued). There is no combined
 * rice+wheat ceiling.
 *
 * UNITS
 * -----
 * Grams is canonical for allocation and for everything that touches the
 * device. Kilograms remain the storage/reporting unit for wallets and
 * transactions (NUMERIC(8,2)), which is what analytics and the UI display.
 * gramsToKg/kgToGrams below are the only conversion points; ALLOCATION_GRAMS_STEP
 * guarantees the round trip is lossless.
 */

const SUPPORTED_COMMODITIES = ["rice", "wheat"];

// policies column holding each commodity's per-card allocation.
const COMMODITY_POLICY_COLUMN = {
    rice: "rice_per_card_grams",
    wheat: "wheat_per_card_grams",
};

// wallets column holding each commodity's balance (kg).
const COMMODITY_WALLET_COLUMN = {
    rice: "rice_balance_kg",
    wheat: "wheat_balance_kg",
};

const gramsToKg = (grams) => Number((Number(grams) / 1000).toFixed(2));
const kgToGrams = (kg) => Math.round(Number(kg) * 1000);

/**
 * The domain invariant. Throws AllocationError when an allocation could not
 * be completed by a single IoT dispense, which is the one thing the whole
 * model exists to guarantee.
 *
 * @param {object} params
 * @param {string} params.commodity      - 'rice' | 'wheat'
 * @param {string} params.category       - ration category, for the message
 * @param {number} params.allocatedGrams - the allocation being proposed
 * @returns {number} the validated allocation in grams
 */
class AllocationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AllocationError";
        this.code = "ALLOCATION_INVALID";
    }
}

const validateAllocation = ({ commodity, category, allocatedGrams }) => {
    if (!SUPPORTED_COMMODITIES.includes(commodity)) {
        throw new AllocationError(`Unsupported commodity "${commodity}" — expected rice or wheat`);
    }

    const grams = Number(allocatedGrams);

    if (!Number.isInteger(grams)) {
        throw new AllocationError(
            `Allocation for ${category}/${commodity} must be a whole number of grams, got ${allocatedGrams}`,
        );
    }
    if (grams <= 0) {
        throw new AllocationError(`Allocation for ${category}/${commodity} must be greater than 0 g, got ${grams} g`);
    }
    if (grams > MAX_DISPENSE_TRANSACTION_GRAMS) {
        throw new AllocationError(
            `Allocation for ${category}/${commodity} is ${grams} g, which exceeds the ` +
            `${MAX_DISPENSE_TRANSACTION_GRAMS} g a single dispensing transaction can complete`,
        );
    }
    if (grams % ALLOCATION_GRAMS_STEP !== 0) {
        throw new AllocationError(
            `Allocation for ${category}/${commodity} must be a multiple of ${ALLOCATION_GRAMS_STEP} g ` +
            `so it converts to kg without loss, got ${grams} g`,
        );
    }

    return grams;
};

/**
 * Turns one `policies` row into the household's validated allocation.
 * Called by every wallet-funding path so they cannot drift apart (they did
 * before: the monthly cron applied a hardcoded flat 35 kg to AAY rice while
 * the three adminController paths used the per-person figure).
 *
 * @param {object} policy - a row from `policies`
 * @returns {{riceGrams: number, wheatGrams: number, riceKg: number, wheatKg: number}}
 */
const allocationForPolicy = (policy) => {
    if (!policy) throw new AllocationError("Policy row is required to compute an allocation");

    const category = policy.category;
    const riceGrams = validateAllocation({
        commodity: "rice",
        category,
        allocatedGrams: Number(policy.rice_per_card_grams),
    });
    const wheatGrams = validateAllocation({
        commodity: "wheat",
        category,
        allocatedGrams: Number(policy.wheat_per_card_grams),
    });

    return {
        riceGrams,
        wheatGrams,
        riceKg: gramsToKg(riceGrams),
        wheatKg: gramsToKg(wheatGrams),
    };
};

// The SELECT list every caller uses to read an allocation policy, so a future
// column rename lands in one place.
const POLICY_SELECT_COLUMNS = "category, rice_per_card_grams, wheat_per_card_grams";

/**
 * The authoritative allocation for one ration card, resolved through its
 * category's policy. This is THE answer to "how much is this household
 * authorised to receive for this commodity, in the one transaction that
 * fulfils it" — no caller may substitute its own number.
 *
 * Runs on the caller's client so it participates in their transaction (both
 * dispensing paths call it inside their own BEGIN).
 *
 * @param {object} client - pg client or pool
 * @param {string} rationCardId
 * @returns {Promise<null|{category, riceGrams, wheatGrams, riceKg, wheatKg}>}
 */
const getCardAllocation = async (client, rationCardId) => {
    const { rows } = await client.query(
        `SELECT p.category, p.rice_per_card_grams, p.wheat_per_card_grams
     FROM ration_cards rc
     JOIN policies p ON p.category = rc.category
     WHERE rc.id = $1`,
        [rationCardId],
    );
    if (rows.length === 0) return null;

    const allocation = allocationForPolicy(rows[0]);
    return { category: rows[0].category, ...allocation };
};

// Per-commodity accessor so callers don't hand-build "riceGrams"/"wheatGrams".
const allocationGramsFor = (allocation, commodity) =>
    commodity === "rice" ? allocation.riceGrams : allocation.wheatGrams;

module.exports = {
    MAX_DISPENSE_TRANSACTION_GRAMS,
    ALLOCATION_GRAMS_STEP,
    SUPPORTED_COMMODITIES,
    COMMODITY_POLICY_COLUMN,
    COMMODITY_WALLET_COLUMN,
    POLICY_SELECT_COLUMNS,
    AllocationError,
    validateAllocation,
    allocationForPolicy,
    getCardAllocation,
    allocationGramsFor,
    gramsToKg,
    kgToGrams,
};
