/**
 * allocation.js
 *
 * Named thresholds for the PDS grain-allocation domain (mirrors the pattern
 * in config/iot.js and config/analytics.js).
 *
 * The IoT dispenser completes a beneficiary's whole allocation for one
 * commodity in a SINGLE weighing. There is deliberately no multi-pass,
 * remaining-balance or accumulator model: one allocation -> one dispense ->
 * one transaction. That only holds if the allocation itself can never exceed
 * what one weighing can deliver, so the ceiling below is a property of the
 * ALLOCATION POLICY, not a clamp applied at the dispensing layer.
 *
 * Three different ceilings exist in this system and must not be conflated
 * (see also config/iot.js):
 *
 *   MAX_DISPENSE_TRANSACTION_GRAMS (here, 4000)
 *       Business rule. "How much is this household authorised to receive for
 *       one commodity, in the one transaction that fulfils it?" Enforced in
 *       the policy table itself (CHECK constraints) so no calculation in any
 *       service can produce a larger allocation.
 *
 *   commodity_tolerances (database table)
 *       Measurement rule. "Did the device dispense approximately the
 *       allocated amount?" — max(min_tolerance_grams, entitled x pct).
 *
 *   MAX_VALID_GRAMS (config/iot.js, 5000)
 *       Hardware safety rule. "Is this reading physically plausible for the
 *       load cell, or is the frame garbage?" It is the 5 kg cell's RATED
 *       CAPACITY, deliberately above the business ceiling: 4500 g is a
 *       physically credible reading that simply fails the business rule, while
 *       5100 g is not a measurement at all. It rejects bad frames; it does not
 *       authorise grain.
 */
module.exports = {
    // The complete allocation for ONE commodity for ONE ration card, in
    // grams. Grams is the canonical allocation unit: it is what the policy
    // table stores and what the IoT session consumes, so the value crosses
    // the domain/device boundary without a conversion.
    MAX_DISPENSE_TRANSACTION_GRAMS: 4000,

    // Policy grams must be a whole number of decagrams. wallets.*_balance_kg
    // is NUMERIC(8,2), so an allocation like 3333 g would round-trip as
    // 3.33 kg -> 3330 g and silently lose 3 g every month. Restricting policy
    // values to multiples of 10 g makes grams <-> kg exact in both
    // directions. See gramsToKg/kgToGrams in services/allocationPolicyService.
    ALLOCATION_GRAMS_STEP: 10,
};
