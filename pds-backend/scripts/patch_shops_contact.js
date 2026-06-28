const pool = require('../src/config/db');
(async () => {
  try {
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20)`);
    console.log('✓ contact_number added to shops');
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`);
    console.log('✓ is_active confirmed on shops');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
