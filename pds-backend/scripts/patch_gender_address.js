/**
 * One-time patch: add gender to users, address to ration_cards.
 * Run once: node scripts/patch_gender_address.js
 */
const pool = require('../src/config/db');

(async () => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
    console.log('✓ gender column added to users');

    await pool.query(`ALTER TABLE ration_cards ADD COLUMN IF NOT EXISTS address TEXT`);
    console.log('✓ address column added to ration_cards');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
