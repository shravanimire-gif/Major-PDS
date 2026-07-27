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

    await pool.query(`
    CREATE TABLE IF NOT EXISTS iot_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(100) NOT NULL UNIQUE,
      device_token_hash TEXT NOT NULL,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      token_expires_at TIMESTAMP,
      last_seen_at TIMESTAMP,
      needs_recalibration BOOLEAN NOT NULL DEFAULT false,
      calibrated_at TIMESTAMP,
      previous_token_hash TEXT,
      previous_token_expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_reading_rejections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(100) NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,
      rejected_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      device_id VARCHAR(100) NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,
      grams_int INTEGER NOT NULL,
      taken_at TIMESTAMP NOT NULL,
      session_id VARCHAR(150),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS dispense_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      ration_card_id UUID NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
      commodity VARCHAR(20) NOT NULL,
      entitled_grams INTEGER NOT NULL,
      tolerance_grams INTEGER NOT NULL,
      device_id VARCHAR(100) REFERENCES iot_devices(device_id) ON DELETE SET NULL,
      state VARCHAR(30) NOT NULL DEFAULT 'active',
      opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      attached_at TIMESTAMP,
      committed_at TIMESTAMP
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS dispense_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES dispense_sessions(id) ON DELETE RESTRICT,
      ration_card_id UUID NOT NULL REFERENCES ration_cards(id) ON DELETE RESTRICT,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
      commodity VARCHAR(20) NOT NULL,
      entitled_grams INTEGER NOT NULL,
      measured_grams INTEGER NOT NULL,
      prev_hash TEXT,
      row_hash TEXT NOT NULL,
      committed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      blockchain_tx_hash TEXT,
      last_anchor_error TEXT
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS commodity_tolerances (
      commodity VARCHAR(20) PRIMARY KEY,
      min_tolerance_grams INTEGER NOT NULL DEFAULT 20,
      tolerance_pct NUMERIC(5,2) NOT NULL DEFAULT 1.00
    )
  `);
    await pool.query(`
    INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct) VALUES
      ('rice', 20, 1.00), ('wheat', 20, 1.00), ('sugar', 20, 1.00)
    ON CONFLICT (commodity) DO NOTHING
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS used_jtis (
      jti TEXT PRIMARY KEY,
      session_id UUID NOT NULL REFERENCES dispense_sessions(id) ON DELETE CASCADE,
      used_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS anomaly_rules (
      rule_key VARCHAR(50) PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT true,
      severity VARCHAR(20) NOT NULL,
      params_json JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
    await pool.query(`
    INSERT INTO anomaly_rules (rule_key, severity, params_json) VALUES
      ('NEAR_TOLERANCE', 'warn', '{"edge_margin_grams": 10, "window_days": 7, "min_occurrences": 3}'),
      ('OFF_HOURS', 'warn', '{"start_hour": 7, "end_hour": 21, "timezone": "Asia/Kolkata"}'),
      ('RAPID_FIRE', 'critical', '{"max_commits_per_minute": 6}'),
      ('DEVICE_ANOMALY', 'critical', '{"reject_pct_threshold": 5, "window_hours": 24}')
    ON CONFLICT (rule_key) DO NOTHING
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS anomaly_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_key VARCHAR(50) NOT NULL REFERENCES anomaly_rules(rule_key) ON DELETE RESTRICT,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      device_id VARCHAR(100) REFERENCES iot_devices(device_id) ON DELETE SET NULL,
      dispense_record_id UUID REFERENCES dispense_records(id) ON DELETE SET NULL,
      severity VARCHAR(20) NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP,
      auto_resolved_at TIMESTAMP
    )
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS iot_audit (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_type VARCHAR(20) NOT NULL,
      actor_id UUID,
      action VARCHAR(50) NOT NULL,
      target TEXT NOT NULL,
      at_time TIMESTAMP NOT NULL DEFAULT NOW(),
      meta_json JSONB NOT NULL DEFAULT '{}'
    )
  `);
};

const truncateAll = async () => {
    await pool.query(`
    TRUNCATE TABLE
      iot_audit, anomaly_flags, used_jtis, dispense_records, dispense_sessions,
      sensor_reading_rejections, sensor_readings, iot_devices,
      qr_sessions, transactions, wallets,
      family_members, ration_cards, shops, users, policies, areas
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
