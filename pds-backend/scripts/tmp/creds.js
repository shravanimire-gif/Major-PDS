const pool = require('../../src/config/db');
const bcrypt = require('bcrypt');
(async () => {
  const r = await pool.query(`SELECT id,email,role,password_hash FROM users WHERE email IN ('admin@pds.gov','ajay.wankhede@pds.gov')`);
  for (const u of r.rows) {
    const candidates = ['abcd1234','admin123','Admin@123','password','pds1234','ajay1234'];
    let match = null;
    for (const c of candidates) { if (u.password_hash && await bcrypt.compare(c, u.password_hash)) { match = c; break; } }
    console.log(u.role.padEnd(11), u.email.padEnd(26), 'password:', match || '(none of the common ones)');
  }
  await pool.end();
})();
