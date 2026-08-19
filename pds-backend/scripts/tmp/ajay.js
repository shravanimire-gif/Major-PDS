const pool = require('../../src/config/db');
(async () => {
  const q = async (label, sql, params=[]) => {
    try { const r = await pool.query(sql, params); console.log('=== '+label+' ==='); console.log(JSON.stringify(r.rows,null,1)); }
    catch(e){ console.log('=== '+label+' ERROR: '+e.message); }
  };
  await q('users cols', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position`);
  await q('shops cols', `SELECT column_name,data_type FROM information_schema.columns WHERE table_name='shops' ORDER BY ordinal_position`);
  await q('ajay', `SELECT id,name,email,role,is_active FROM users WHERE email ILIKE '%ajay%'`);
  await q('shops', `SELECT id, shop_code, shop_name, shopkeeper_id, is_active FROM shops ORDER BY shop_name`);
  await pool.end();
})();
