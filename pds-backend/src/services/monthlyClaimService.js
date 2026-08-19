const logger = require("../config/logger");
const { SUPPORTED_COMMODITIES } = require("./allocationPolicyService");

/**
 * monthlyClaimService.js
 *
 * The single authoritative answer to "has this ration card already received
 * its allocation for this commodity in the current period?", shared by every
 * dispensing path. Before this existed the rule was copy-pasted into
 * shopkeeperController twice and absent from the IoT path entirely, so the
 * same business question had three different answers depending on how the
 * grain left the shop.
 *
 * PERIOD SEMANTICS (unchanged — this is what the code already meant)
 * ------------------------------------------------------------------
 * A "claim" is the existence of a committed row in `transactions` for this
 * ration card within the current CALENDAR MONTH. It is not derived from the
 * wallet: a wallet balance is an allocation, not evidence that grain was
 * handed over, and `wallets.last_reset_date` tracks when the entitlement cron
 * refilled the wallet, not when a beneficiary was served. `transactions` is
 * the canonical business record and stays the only input here.
 *
 * PER COMMODITY, NOT PER CARD
 * ---------------------------
 * The original rule was "any transaction this month blocks another claim".
 * That is correct for the manual path, where one row carries rice AND wheat
 * together. It is wrong for IoT: a dispense_session covers exactly one
 * commodity, so a beneficiary collecting both legitimately produces TWO
 * transaction rows. Applying the old rule to the IoT path would have made
 * wheat undispensable for the rest of the month as soon as rice was taken.
 *
 * So eligibility is evaluated per commodity:
 *     rice claimed  <=> a transaction this month with rice_qty_kg  > 0
 *     wheat claimed <=> a transaction this month with wheat_qty_kg > 0
 *
 * A manual dispense of rice+wheat consumes both in one row; an IoT rice
 * dispense consumes only rice. Either way, each commodity is claimable once.
 *
 * CONCURRENCY
 * -----------
 * The check below is advisory — it exists to return a clean 400 instead of a
 * constraint violation. The actual guarantee is two partial unique indexes on
 * `transactions` (migration 025), which is why callers MUST run this check on
 * the same client inside their own transaction and MUST still handle a 23505.
 * A SELECT-then-INSERT alone is a time-of-check/time-of-use race: that is
 * exactly the bug the old implementation had, since it queried `pool` (a
 * different connection) before `client.query("BEGIN")`.
 */

// PostgreSQL error code for unique_violation.
const UNIQUE_VIOLATION = "23505";

// The partial unique indexes created by migration 025.
const CLAIM_INDEXES = {
    rice: "transactions_rice_monthly_claim_unique_index",
    wheat: "transactions_wheat_monthly_claim_unique_index",
};

const COMMODITY_QTY_COLUMN = {
    rice: "rice_qty_kg",
    wheat: "wheat_qty_kg",
};

class MonthlyClaimError extends Error {
    constructor(commodities) {
        const list = commodities.join(" and ");
        super(`Already claimed this month`);
        this.name = "MonthlyClaimError";
        this.code = "ALREADY_CLAIMED_THIS_MONTH";
        this.commodities = commodities;
        this.detail = `This ration card has already been served ${list} in the current month`;
    }
}

/**
 * Which commodities this card has already claimed in the current calendar
 * month. Runs on the caller's client so it participates in their transaction.
 *
 * @param {object} client - an active pg client inside a transaction
 * @param {string} rationCardId
 * @returns {Promise<string[]>} e.g. [] | ['rice'] | ['rice','wheat']
 */
const getClaimedCommodities = async (client, rationCardId) => {
    const { rows } = await client.query(
        `SELECT
       COALESCE(BOOL_OR(rice_qty_kg  > 0), false) AS rice_claimed,
       COALESCE(BOOL_OR(wheat_qty_kg > 0), false) AS wheat_claimed
     FROM transactions
     WHERE ration_card_id = $1
       AND created_at >= date_trunc('month', CURRENT_DATE)
       AND created_at <  date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`,
        [rationCardId],
    );

    const row = rows[0] || {};
    const claimed = [];
    if (row.rice_claimed) claimed.push("rice");
    if (row.wheat_claimed) claimed.push("wheat");
    return claimed;
};

/**
 * Throws MonthlyClaimError if any of `commodities` was already claimed this
 * month. `commodities` is the set the caller is about to dispense — a manual
 * rice+wheat dispense passes both; an IoT session passes its single commodity.
 *
 * @param {object} client       - active pg client inside a transaction
 * @param {string} rationCardId
 * @param {string[]} commodities
 */
const assertClaimable = async (client, rationCardId, commodities) => {
    const requested = commodities.filter((c) => SUPPORTED_COMMODITIES.includes(c));
    if (requested.length === 0) return;

    const claimed = await getClaimedCommodities(client, rationCardId);
    const conflicts = requested.filter((c) => claimed.includes(c));

    if (conflicts.length > 0) {
        logger.warn("[Claim] Double claim attempt", {
            ration_card_id: rationCardId,
            requested,
            already_claimed: conflicts,
        });
        throw new MonthlyClaimError(conflicts);
    }
};

/**
 * Translates a PostgreSQL unique_violation on one of the monthly-claim indexes
 * into the same MonthlyClaimError the pre-check raises, so a request that lost
 * a concurrency race gets the identical response as one that simply arrived
 * second. Returns null for any other error, which the caller should rethrow.
 */
const asMonthlyClaimError = (err) => {
    if (!err || err.code !== UNIQUE_VIOLATION) return null;

    const constraint = err.constraint || "";
    const commodity = Object.keys(CLAIM_INDEXES).find((c) => CLAIM_INDEXES[c] === constraint);
    if (!commodity) return null;

    logger.warn("[Claim] Double claim blocked by the database (concurrent request)", {
        constraint,
        commodity,
    });
    return new MonthlyClaimError([commodity]);
};

module.exports = {
    MonthlyClaimError,
    CLAIM_INDEXES,
    COMMODITY_QTY_COLUMN,
    UNIQUE_VIOLATION,
    getClaimedCommodities,
    assertClaimable,
    asMonthlyClaimError,
};
