/**
 * One-time patch: add relationship column to family_members.
 * Run once: node scripts/patch_family_relationship.js
 */
const pool = require('../src/config/db');

(async () => {
  try {
    await pool.query(`ALTER TABLE family_members ADD COLUMN IF NOT EXISTS relationship VARCHAR(50)`);
    console.log('✓ relationship column added to family_members');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
