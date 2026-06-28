const pool = require('../src/config/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. ration_cards → cascades wallets + family_members automatically
    const rc = await client.query('DELETE FROM ration_cards');
    console.log(`✓ Deleted ${rc.rowCount} ration card(s)  [wallets + family_members cascade-deleted]`);

    // 2. shops (now safe — no ration_cards reference them)
    const sh = await client.query('DELETE FROM shops');
    console.log(`✓ Deleted ${sh.rowCount} shop(s)`);

    // 3. shopkeepers + beneficiaries  (admin rows untouched)
    const us = await client.query(`DELETE FROM users WHERE role IN ('shopkeeper', 'beneficiary')`);
    console.log(`✓ Deleted ${us.rowCount} user(s)  [shopkeepers + beneficiaries]`);

    await client.query('COMMIT');
    console.log('\nDone. Admin account is intact.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
