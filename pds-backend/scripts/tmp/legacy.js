const pool = require('../../src/config/db');
(async () => {
  const q = async (l, s) => { const r = await pool.query(s); console.log('=== '+l+' ==='); console.log(JSON.stringify(r.rows,null,1)); };
  await q('offending dispense_records', `
    SELECT dr.id, dr.commodity, dr.entitled_grams, dr.measured_grams,
           t.rice_qty_kg, dr.committed_at, t.created_at AS tx_created_at
      FROM dispense_records dr JOIN transactions t ON t.id = dr.transaction_id
     WHERE (dr.commodity='rice'  AND ROUND(t.rice_qty_kg*1000)  <> dr.entitled_grams)
        OR (dr.commodity='wheat' AND ROUND(t.wheat_qty_kg*1000) <> dr.entitled_grams)
     ORDER BY dr.committed_at`);
  await q('all dispense_records', `SELECT id, commodity, entitled_grams, measured_grams, committed_at FROM dispense_records ORDER BY committed_at`);
  await q('migrations 021-026', `SELECT name, run_on FROM pgmigrations WHERE name LIKE '02%' ORDER BY run_on`);
  await pool.end();
})();
