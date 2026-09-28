// Updates the APL category per-card entitlement policy to 1000 g (1 kg) rice
// and 700 g (0.7 kg) wheat per ration card per month. Updates existing APL
// wallet balances to match. BPL and AAY policies and wallets remain unchanged.

exports.up = (pgm) => {
    // 1. Update APL policy per-card entitlement
    pgm.sql(`
      UPDATE policies
         SET rice_per_card_grams = 1000,
             wheat_per_card_grams = 700
       WHERE category = 'APL';
    `);

    // 2. Update existing APL wallet balances to 1.0 kg rice and 0.7 kg wheat
    pgm.sql(`
      UPDATE wallets w
         SET rice_balance_kg = 1.0,
             wheat_balance_kg = 0.7,
             last_reset_date = CURRENT_DATE,
             updated_at = NOW()
        FROM ration_cards rc
       WHERE w.ration_card_id = rc.id
         AND rc.category = 'APL';
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
      UPDATE policies
         SET rice_per_card_grams = 2000,
             wheat_per_card_grams = 1500
       WHERE category = 'APL';
    `);

    pgm.sql(`
      UPDATE wallets w
         SET rice_balance_kg = 2.0,
             wheat_balance_kg = 1.5,
             last_reset_date = CURRENT_DATE,
             updated_at = NOW()
        FROM ration_cards rc
       WHERE w.ration_card_id = rc.id
         AND rc.category = 'APL';
    `);
};
