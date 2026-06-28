const pool = require("../config/db");
const logger = require("../config/logger");

const toNumber = (value) => Number.parseFloat(value || 0);

const getAssignedShop = async (client, userId) => {
  const result = await client.query(
    `
      SELECT
        s.id,
        s.shop_code,
        s.shop_name,
        s.area_id,
        a.name AS area_name
      FROM shops s
      LEFT JOIN areas a ON a.id = s.area_id
      WHERE s.shopkeeper_id = $1
        AND COALESCE(s.is_active, true) = true
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] || null;
};

const getMe = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userResult = await pool.query(
      `
        SELECT id, name, email, mobile, role, is_active
        FROM users
        WHERE id = $1
          AND role = 'shopkeeper'
          AND COALESCE(is_active, true) = true
        LIMIT 1
      `,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Shopkeeper profile not found" });
    }

    const shop = await getAssignedShop(pool, userId);
    if (!shop) {
      return res.status(404).json({ error: "No active shop assigned" });
    }

    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS today_count
        FROM transactions
        WHERE shop_id = $1
          AND DATE(created_at) = CURRENT_DATE
      `,
      [shop.id],
    );

    const user = userResult.rows[0];

    return res.status(200).json({
      shopkeeper: {
        id: user.id,
        name: user.name || user.email?.split("@")[0] || "Shopkeeper",
        email: user.email,
        mobile: user.mobile,
      },
      shop: {
        id: shop.id,
        name: shop.shop_name,
        code: shop.shop_code,
        area: shop.area_name,
      },
      today_transactions: countResult.rows[0]?.today_count || 0,
    });
  } catch (error) {
    return next(error);
  }
};

const getBeneficiaryByRationCardId = async (req, res, next) => {
  try {
    const rationCardId = req.params.id;
    const sessionId = req.query.sessionId;
    const shop = await getAssignedShop(pool, req.user.id);

    if (!shop) {
      return res.status(404).json({ error: "No active shop assigned" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const qrSessionResult = await pool.query(
      `
        SELECT
          session_id,
          ration_card_id,
          shop_id,
          issued_to_user_id,
          expires_at,
          is_used
        FROM qr_sessions
        WHERE session_id = $1
        LIMIT 1
      `,
      [sessionId],
    );

    if (qrSessionResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const qrSession = qrSessionResult.rows[0];
    if (qrSession.ration_card_id !== rationCardId) {
      return res.status(400).json({ error: "QR does not match ration card" });
    }
    if (qrSession.shop_id !== shop.id) {
      return res.status(403).json({ error: "QR session belongs to another shop" });
    }
    const beneficiaryUserId =
      req.query?.beneficiary_user_id ||
      req.body?.beneficiary_user_id ||
      qrSession.issued_to_user_id;
    if (!qrSession.issued_to_user_id || qrSession.issued_to_user_id !== beneficiaryUserId) {
      return res.status(403).json({ error: "QR session belongs to another user" });
    }
    if (qrSession.is_used) {
      return res.status(409).json({ error: "QR session already used" });
    }
    if (new Date(qrSession.expires_at) < new Date()) {
      return res.status(401).json({ error: "QR session expired" });
    }

    const result = await pool.query(
      `
        SELECT
          rc.id AS ration_card_id,
          rc.card_number,
          rc.category,
          rc.shop_id,
          s.shop_name,
          a.name AS area_name,
          fm_head.name AS beneficiary_name,
          u.mobile,
          (
            SELECT COUNT(*)
            FROM family_members fm
            WHERE fm.ration_card_id = rc.id
          )::int AS family_size,
          w.rice_balance_kg,
          w.wheat_balance_kg,
          w.sugar_balance_kg
        FROM ration_cards rc
        JOIN shops s ON s.id = rc.shop_id
        LEFT JOIN areas a ON a.id = rc.area_id
        JOIN family_members fm_head
          ON fm_head.ration_card_id = rc.id
         AND fm_head.is_head = true
        LEFT JOIN users u ON u.id = fm_head.user_id
        JOIN wallets w ON w.ration_card_id = rc.id
        WHERE rc.id = $1
          AND COALESCE(rc.is_active, true) = true
        LIMIT 1
      `,
      [rationCardId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Beneficiary not found" });
    }

    const row = result.rows[0];

    if (row.shop_id !== shop.id) {
      return res
        .status(403)
        .json({ error: "Beneficiary belongs to a different shop" });
    }

    return res.status(200).json({
      beneficiary: {
        ration_card_id: row.ration_card_id,
        card_number: row.card_number,
        name: row.beneficiary_name,
        category: row.category,
        mobile: row.mobile,
        family_size: row.family_size,
        shop_name: row.shop_name,
        area_name: row.area_name,
      },
      wallet: {
        rice_balance_kg: toNumber(row.rice_balance_kg),
        wheat_balance_kg: toNumber(row.wheat_balance_kg),
        sugar_balance_kg: toNumber(row.sugar_balance_kg),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const dispense = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      ration_card_id: rationCardId,
      session_id: sessionId,
      beneficiary_user_id: beneficiaryUserId,
      rice_qty_kg: riceQtyRaw = 0,
      wheat_qty_kg: wheatQtyRaw = 0,
      sugar_qty_kg: sugarQtyRaw = 0,
    } = req.body;

    const riceQty = Number(riceQtyRaw);
    const wheatQty = Number(wheatQtyRaw);
    const sugarQty = Number(sugarQtyRaw);

    if (!rationCardId || !sessionId) {
      return res
        .status(400)
        .json({ error: "ration_card_id and session_id are required" });
    }

    if (
      !Number.isFinite(riceQty) ||
      !Number.isFinite(wheatQty) ||
      !Number.isFinite(sugarQty)
    ) {
      return res.status(400).json({ error: "Quantities must be valid numbers" });
    }

    if (riceQty < 0 || wheatQty < 0 || sugarQty < 0) {
      return res.status(400).json({ error: "Quantities must be >= 0" });
    }

    if (riceQty === 0 && wheatQty === 0 && sugarQty === 0) {
      return res
        .status(400)
        .json({ error: "At least one quantity must be greater than zero" });
    }

    // Double-claim prevention: one dispense per ration card per month
    const claimCheck = await pool.query(
      `SELECT COUNT(*) FROM transactions
       WHERE ration_card_id = $1
         AND DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)
         AND DATE(created_at) < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
      [rationCardId],
    );
    if (Number(claimCheck.rows[0].count) > 0) {
      logger.warn('[Dispense] Double claim attempt', { ration_card_id: rationCardId });
      return res.status(400).json({
        error: "Already claimed this month",
        detail: "This ration card has already been served in the current month",
      });
    }

    await client.query("BEGIN");

    const shop = await getAssignedShop(client, req.user.id);
    if (!shop) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No active shop assigned" });
    }

    const sessionResult = await client.query(
      `
        SELECT
          session_id,
          ration_card_id,
          shop_id,
          issued_to_user_id,
          expires_at,
          is_used
        FROM qr_sessions
        WHERE session_id = $1
        FOR UPDATE
      `,
      [sessionId],
    );

    if (sessionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "Invalid session" });
    }

    const session = sessionResult.rows[0];
    if (session.ration_card_id !== rationCardId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "QR does not match ration card" });
    }
    if (session.shop_id !== shop.id) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "QR session belongs to another shop" });
    }
    const servedBeneficiaryUserId = beneficiaryUserId || session.issued_to_user_id;
    if (!session.issued_to_user_id || session.issued_to_user_id !== servedBeneficiaryUserId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "QR session belongs to another user" });
    }
    if (session.is_used) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "QR session already used" });
    }
    if (new Date(session.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "QR session expired" });
    }

    const walletResult = await client.query(
      `
        SELECT
          w.id,
          w.ration_card_id,
          w.rice_balance_kg,
          w.wheat_balance_kg,
          w.sugar_balance_kg,
          rc.shop_id
        FROM wallets w
        JOIN ration_cards rc ON rc.id = w.ration_card_id
        WHERE w.ration_card_id = $1
        FOR UPDATE
      `,
      [rationCardId],
    );

    if (walletResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Wallet not found" });
    }

    const wallet = walletResult.rows[0];
    if (wallet.shop_id !== shop.id) {
      await client.query("ROLLBACK");
      logger.warn('Shop mismatch', { shopkeeper_id: req.user.id, ration_card_id: rationCardId });
      return res.status(403).json({ error: "Wallet belongs to another shop" });
    }

    const riceBalance = toNumber(wallet.rice_balance_kg);
    const wheatBalance = toNumber(wallet.wheat_balance_kg);
    const sugarBalance = toNumber(wallet.sugar_balance_kg);

    if (riceQty > riceBalance || wheatQty > wheatBalance || sugarQty > sugarBalance) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Requested quantity exceeds wallet balance",
        wallet: {
          rice_balance_kg: riceBalance,
          wheat_balance_kg: wheatBalance,
          sugar_balance_kg: sugarBalance,
        },
      });
    }

    const remainingRice = Number((riceBalance - riceQty).toFixed(2));
    const remainingWheat = Number((wheatBalance - wheatQty).toFixed(2));
    const remainingSugar = Number((sugarBalance - sugarQty).toFixed(2));

    await client.query(
      `
        UPDATE wallets
        SET
          rice_balance_kg = $1,
          wheat_balance_kg = $2,
          sugar_balance_kg = $3,
          updated_at = NOW()
        WHERE ration_card_id = $4
      `,
      [remainingRice, remainingWheat, remainingSugar, rationCardId],
    );

    const txResult = await client.query(
      `
        INSERT INTO transactions (
          ration_card_id,
          shop_id,
          rice_qty_kg,
          wheat_qty_kg,
          sugar_qty_kg,
          served_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `,
      [rationCardId, shop.id, riceQty, wheatQty, sugarQty, req.user.id],
    );

    await client.query(
      `
        UPDATE qr_sessions
        SET
          is_used = true,
          used_at = NOW()
        WHERE session_id = $1
      `,
      [sessionId],
    );

    await client.query("COMMIT");

    logger.info('Dispense success', { ration_card_id: rationCardId, rice_qty: riceQty, wheat_qty: wheatQty, sugar_qty: sugarQty });

    return res.status(200).json({
      message: "Dispensed successfully",
      transaction: txResult.rows[0],
      dispensed: {
        rice_qty_kg: riceQty,
        wheat_qty_kg: wheatQty,
        sugar_qty_kg: sugarQty,
      },
      remaining_wallet: {
        rice_balance_kg: remainingRice,
        wheat_balance_kg: remainingWheat,
        sugar_balance_kg: remainingSugar,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      // Ignore rollback failures and surface original error.
    }

    return next(error);
  } finally {
    client.release();
  }
};

// POST /api/shopkeeper/transactions — blockchain-stable endpoint
// Shape is final: never rename fields, never remove fields.
const createTransaction = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const {
      ration_card_id: rationCardId,
      rice_qty: riceQtyRaw = 0,
      wheat_qty: wheatQtyRaw = 0,
      sugar_qty: sugarQtyRaw = 0,
    } = req.body;

    const riceQty = Number(riceQtyRaw);
    const wheatQty = Number(wheatQtyRaw);
    const sugarQty = Number(sugarQtyRaw);

    // Double-claim prevention
    const claimCheck = await pool.query(
      `SELECT COUNT(*) FROM transactions
       WHERE ration_card_id = $1
         AND DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)
         AND DATE(created_at) <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
      [rationCardId],
    );
    if (Number(claimCheck.rows[0].count) > 0) {
      logger.warn('[Dispense] Double claim attempt', { ration_card_id: rationCardId });
      return res.status(400).json({
        error: 'Already claimed this month',
        detail: 'This ration card has already been served in the current month',
      });
    }

    await client.query('BEGIN');

    const shop = await getAssignedShop(client, req.user.id);
    if (!shop) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No active shop assigned' });
    }

    // Wallet + shop ownership check
    const walletResult = await client.query(
      `SELECT w.id, w.ration_card_id, w.rice_balance_kg, w.wheat_balance_kg, w.sugar_balance_kg,
              rc.shop_id, rc.card_number
       FROM wallets w
       JOIN ration_cards rc ON rc.id = w.ration_card_id
       WHERE w.ration_card_id = $1
       FOR UPDATE`,
      [rationCardId],
    );

    if (walletResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];
    if (wallet.shop_id !== shop.id) {
      await client.query('ROLLBACK');
      logger.warn('[Transaction] Shop mismatch', { shopkeeper_id: req.user.id, ration_card_id: rationCardId });
      return res.status(403).json({ error: 'Beneficiary belongs to a different shop' });
    }

    const riceBalance = toNumber(wallet.rice_balance_kg);
    const wheatBalance = toNumber(wallet.wheat_balance_kg);
    const sugarBalance = toNumber(wallet.sugar_balance_kg);

    if (riceQty > riceBalance || wheatQty > wheatBalance || sugarQty > sugarBalance) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Requested quantity exceeds wallet balance',
        wallet: { rice_balance_kg: riceBalance, wheat_balance_kg: wheatBalance, sugar_balance_kg: sugarBalance },
      });
    }

    const remainingRice = Number((riceBalance - riceQty).toFixed(2));
    const remainingWheat = Number((wheatBalance - wheatQty).toFixed(2));
    const remainingSugar = Number((sugarBalance - sugarQty).toFixed(2));

    await client.query(
      `UPDATE wallets
       SET rice_balance_kg = $1, wheat_balance_kg = $2, sugar_balance_kg = $3, updated_at = NOW()
       WHERE ration_card_id = $4`,
      [remainingRice, remainingWheat, remainingSugar, rationCardId],
    );

    const txResult = await client.query(
      `INSERT INTO transactions (ration_card_id, shop_id, rice_qty_kg, wheat_qty_kg, sugar_qty_kg, served_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, ration_card_id, shop_id, served_by, rice_qty_kg, wheat_qty_kg, sugar_qty_kg, created_at`,
      [rationCardId, shop.id, riceQty, wheatQty, sugarQty, req.user.id],
    );

    await client.query('COMMIT');

    const tx = txResult.rows[0];
    logger.info('[Transaction] Success', { ration_card_id: rationCardId, transaction_id: tx.id });

    // Stable blockchain payload — field names and shape are final
    return res.status(200).json({
      success: true,
      transaction: {
        id: tx.id,
        ration_card_id: tx.ration_card_id,
        card_number: wallet.card_number,
        shop_id: tx.shop_id,
        served_by: tx.served_by,
        rice_qty_kg: toNumber(tx.rice_qty_kg),
        wheat_qty_kg: toNumber(tx.wheat_qty_kg),
        sugar_qty_kg: toNumber(tx.sugar_qty_kg),
        created_at: tx.created_at,
        blockchain_tx_hash: null,
      },
      remaining_wallet: {
        rice_balance_kg: remainingRice,
        wheat_balance_kg: remainingWheat,
        sugar_balance_kg: remainingSugar,
      },
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { }
    return next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  getMe,
  getBeneficiaryByRationCardId,
  dispense,
  createTransaction,
};
