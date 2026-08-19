const pool = require('../../src/config/db');
(async () => {
  const q = async (label, sql, params=[]) => {
    try { const r = await pool.query(sql, params); console.log('=== '+label+' ==='); console.log(JSON.stringify(r.rows,null,1)); }
    catch(e){ console.log('=== '+label+' ERROR: '+e.message); }
  };
  await q('tables', `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`);
  await q('iot_devices cols', `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='iot_devices' ORDER BY ordinal_position`);
  await q('iot_devices rows', `SELECT device_id, shop_id, status, last_seen_at, needs_recalibration, calibrated_at FROM iot_devices`);
  await q('policies', `SELECT * FROM policies`);
  await q('commodity_tolerances', `SELECT * FROM commodity_tolerances`);
  await pool.end();
})();
