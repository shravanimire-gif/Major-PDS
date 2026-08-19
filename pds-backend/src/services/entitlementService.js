const pool = require("../config/db");
const logger = require("../config/logger");
const {
  POLICY_SELECT_COLUMNS,
  allocationForPolicy,
} = require("./allocationPolicyService");

const computeAllocations = async (client) => {
  const cardsResult = await client.query(`
    SELECT
      rc.id AS ration_card_id,
      rc.card_number,
      rc.category,
      COUNT(fm.id)::int AS family_size,
      MAX(w.last_reset_date) AS last_reset_date
    FROM ration_cards rc
    JOIN family_members fm ON fm.ration_card_id = rc.id
    LEFT JOIN wallets w ON w.ration_card_id = rc.id
    WHERE rc.is_active = true
    GROUP BY rc.id, rc.card_number, rc.category
    ORDER BY rc.card_number
  `);

  const policyResult = await client.query(`
    SELECT ${POLICY_SELECT_COLUMNS}
    FROM policies
  `);

  const policyByCategory = new Map(
    policyResult.rows.map((policy) => [policy.category, policy]),
  );

  return cardsResult.rows.map((card) => {
    const policy = policyByCategory.get(card.category);
    if (!policy) throw new Error(`Policy not found for category ${card.category}`);

    // Allocation is per ration card, not per person — see
    // allocationPolicyService for why, and for the ceiling that makes the
    // result dispensable in one IoT transaction. family_size is still
    // reported (the admin preview shows it) but no longer scales the
    // allocation, and the flat 35 kg AAY rice special case that used to live
    // here is gone: AAY now carries its own per-card policy figure like every
    // other category.
    const familySize = Number(card.family_size);
    const allocation = allocationForPolicy(policy);

    return {
      ration_card_id: card.ration_card_id,
      card_number: card.card_number,
      category: card.category,
      family_size: familySize,
      rice_kg: allocation.riceKg,
      wheat_kg: allocation.wheatKg,
      rice_grams: allocation.riceGrams,
      wheat_grams: allocation.wheatGrams,
      last_reset_date: card.last_reset_date || null,
    };
  });
};

const runEntitlementAllocation = async (options = {}) => {
  const { previewOnly = false } = options;
  const client = await pool.connect();

  try {
    // Idempotency guard: skip if allocation already ran today
    if (!previewOnly) {
      const alreadyRun = await client.query(
        `SELECT COUNT(*) FROM wallets WHERE last_reset_date = CURRENT_DATE`,
      );
      if (Number(alreadyRun.rows[0].count) > 0) {
        logger.warn('[Entitlement] Already run today, skipping');
        return { skipped: true, reason: 'Allocation already run today', processed: 0, allocations: [] };
      }
      logger.info('[Entitlement] Starting allocation...');
    }

    const allocations = await computeAllocations(client);

    if (!previewOnly) {
      await client.query("BEGIN");

      for (const allocation of allocations) {
        await client.query(
          `UPDATE wallets
           SET rice_balance_kg = $1, wheat_balance_kg = $2,
               last_reset_date = CURRENT_DATE, updated_at = NOW()
           WHERE ration_card_id = $3`,
          [allocation.rice_kg, allocation.wheat_kg, allocation.ration_card_id],
        );
      }

      await client.query("COMMIT");
      logger.info('Entitlement allocated', { processed: allocations.length });
    }

    return { processed: allocations.length, allocations };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) { }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { runEntitlementAllocation };
