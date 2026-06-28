const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
});

const createSchema = async () => {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await pool.query(`DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'shopkeeper', 'beneficiary');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    await pool.query(`DO $$ BEGIN
    CREATE TYPE ration_category AS ENUM ('APL', 'BPL', 'AAY');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS areas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category ration_category NOT NULL UNIQUE,
      rice_per_person_kg NUMERIC(5,2) NOT NULL DEFAULT 0,
      wheat_per_person_kg NUMERIC(5,2) NOT NULL DEFAULT 0,
      sugar_per_person_kg NUMERIC(5,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role user_role NOT NULL,
      name VARCHAR(150),
      email VARCHAR(255) UNIQUE,
      mobile VARCHAR(15) UNIQUE,
      password_hash TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_code VARCHAR(20) NOT NULL UNIQUE,
      shop_name VARCHAR(150) NOT NULL,
      area_id UUID NOT NULL REFERENCES areas(id),
      shopkeeper_id UUID REFERENCES users(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS ration_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      card_number VARCHAR(50) NOT NULL UNIQUE,
      category ration_category NOT NULL,
      head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      shop_id UUID NOT NULL REFERENCES shops(id),
      area_id UUID NOT NULL REFERENCES areas(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS family_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ration_card_id UUID NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(150) NOT NULL,
      age INTEGER NOT NULL,
      is_head BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ration_card_id UUID NOT NULL UNIQUE REFERENCES ration_cards(id) ON DELETE CASCADE,
      rice_balance_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
      wheat_balance_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
      sugar_balance_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
      last_reset_date DATE,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ration_card_id UUID NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
      shop_id UUID NOT NULL REFERENCES shops(id),
      rice_qty_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
      wheat_qty_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
      sugar_qty_kg NUMERIC(8,2) NOT NULL DEFAULT 0,
      served_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS qr_sessions (
      session_id VARCHAR(150) PRIMARY KEY,
      ration_card_id UUID NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      issued_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMP NOT NULL,
      is_used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      used_at TIMESTAMP
    )
  `);
};

const truncateAll = async () => {
    await pool.query(`
    TRUNCATE TABLE
      qr_sessions, transactions, wallets, family_members,
      ration_cards, shops, users, policies, areas
    RESTART IDENTITY CASCADE
  `);
};

beforeAll(async () => {
    await createSchema();
    await truncateAll();
});

afterAll(async () => {
    await pool.end();
});

module.exports = { pool, truncateAll };
