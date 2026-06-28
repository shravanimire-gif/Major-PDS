const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const pool = require('./src/config/db');

dotenv.config();

const seedAdmin = async () => {
  try {
    const passwordHash = await bcrypt.hash('abcd1234', 10);

    await pool.query(
      `INSERT INTO users (role, email, password_hash)
       VALUES ('admin', 'admin@pds.gov', $1)
       ON CONFLICT (email) DO NOTHING`,
      [passwordHash]
    );

    console.log('Admin seeded');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
