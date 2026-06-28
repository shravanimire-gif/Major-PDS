/**
 * One-time patch: add sugar_balance_kg to wallets table.
 * Run once: node scripts/patch_wallets_sugar.js
 */
const pool = require('../src/config/db');

(async () => {
  try {
    await pool.query(`
      ALTER TABLE wallets
        ADD COLUMN IF NOT EXISTS sugar_balance_kg NUMERIC(8,2) NOT NULL DEFAULT 0
    `);
    console.log('✓ sugar_balance_kg column added (or already existed)');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
