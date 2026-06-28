-- =============================================================================
-- PDS (Public Distribution System) — Production Schema
-- PostgreSQL 14+  |  Generated from live Neon DB — June 2026
-- =============================================================================
-- HOW TO USE IN pgAdmin:
--   1. Connect to your target database (create a fresh one if needed).
--   2. Open Query Tool (Tools → Query Tool).
--   3. Paste this entire file and click ▶ Execute / F5.
--   4. Everything runs in a single transaction — it either all succeeds or
--      rolls back cleanly.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- provides gen_random_uuid()


-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'shopkeeper', 'beneficiary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ration_category AS ENUM ('APL', 'BPL', 'AAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ---------------------------------------------------------------------------
-- 2. CORE TABLES  (order respects foreign-key dependencies)
-- ---------------------------------------------------------------------------

-- 2.1  areas
CREATE TABLE IF NOT EXISTS areas (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100)  NOT NULL UNIQUE,
	is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- 2.2  policies  (entitlement rules per ration category)
CREATE TABLE IF NOT EXISTS policies (
    id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    category             ration_category NOT NULL UNIQUE,
    rice_per_person_kg   NUMERIC(5,2)    NOT NULL DEFAULT 0,
    wheat_per_person_kg  NUMERIC(5,2)    NOT NULL DEFAULT 0,
    sugar_per_person_kg  NUMERIC(5,2)    NOT NULL DEFAULT 0,
    validity_days        INTEGER         NOT NULL DEFAULT 30,
    updated_at           TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- 2.3  users  (admin / shopkeeper / beneficiary)
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role          user_role   NOT NULL,
    name          VARCHAR(150),
    email         VARCHAR(255) UNIQUE,
    mobile        VARCHAR(15),
    password_hash TEXT,
	address TEXT,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- 2.4  shops
CREATE TABLE IF NOT EXISTS shops (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_code      VARCHAR(20)  NOT NULL UNIQUE,
    shop_name      VARCHAR(150) NOT NULL,
    area_id        UUID         NOT NULL REFERENCES areas(id)         ON DELETE RESTRICT,
    shopkeeper_id  UUID         UNIQUE       REFERENCES users(id)     ON DELETE SET NULL,
    address        TEXT,
	contact_number VARCHAR(15),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shops_area_id        ON shops(area_id);
CREATE INDEX IF NOT EXISTS idx_shops_shopkeeper_id  ON shops(shopkeeper_id);

-- 2.5  ration_cards
CREATE TABLE IF NOT EXISTS ration_cards (
    id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    card_number  VARCHAR(50)     NOT NULL UNIQUE,
    category     ration_category NOT NULL,
    head_user_id UUID            NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    shop_id      UUID            NOT NULL REFERENCES shops(id)  ON DELETE RESTRICT,
    area_id      UUID            NOT NULL REFERENCES areas(id)  ON DELETE RESTRICT,
    is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ration_cards_shop_id      ON ration_cards(shop_id);
CREATE INDEX IF NOT EXISTS idx_ration_cards_area_id      ON ration_cards(area_id);
CREATE INDEX IF NOT EXISTS idx_ration_cards_head_user_id ON ration_cards(head_user_id);

-- 2.6  family_members
CREATE TABLE IF NOT EXISTS family_members (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ration_card_id  UUID        NOT NULL UNIQUE REFERENCES ration_cards(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL UNIQUE REFERENCES users(id)        ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    age             INTEGER      NOT NULL,
    is_head         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_ration_card_id ON family_members(ration_card_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id        ON family_members(user_id);

-- 2.7  wallets  (one per ration card, holds monthly grain balances)
CREATE TABLE IF NOT EXISTS wallets (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ration_card_id    UUID         NOT NULL UNIQUE REFERENCES ration_cards(id) ON DELETE CASCADE,
    rice_balance_kg   NUMERIC(8,2) NOT NULL DEFAULT 0,
    wheat_balance_kg  NUMERIC(8,2) NOT NULL DEFAULT 0,
    last_reset_date   DATE,
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 2.8  transactions  (grain dispense records — immutable audit log)
CREATE TABLE IF NOT EXISTS transactions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ration_card_id      UUID         NOT NULL REFERENCES ration_cards(id) ON DELETE RESTRICT,
    shop_id             UUID         NOT NULL REFERENCES shops(id)        ON DELETE RESTRICT,
    served_by           UUID                  REFERENCES users(id)        ON DELETE NO ACTION,
    rice_qty_kg         NUMERIC(8,2) NOT NULL DEFAULT 0,
    wheat_qty_kg        NUMERIC(8,2) NOT NULL DEFAULT 0,
    sugar_qty_kg        NUMERIC(8,2) NOT NULL DEFAULT 0,
    blockchain_tx_hash  TEXT,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_ration_card_id ON transactions(ration_card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id        ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at     ON transactions(created_at);

-- 2.9  qr_sessions  (short-lived QR tokens for beneficiary → shopkeeper flow)
CREATE TABLE IF NOT EXISTS qr_sessions (
    session_id         VARCHAR(64)  PRIMARY KEY,
    ration_card_id     UUID         NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
    shop_id            UUID         NOT NULL REFERENCES shops(id)        ON DELETE CASCADE,
    issued_to_user_id  UUID                  REFERENCES users(id)        ON DELETE SET NULL,
    expires_at         TIMESTAMP    NOT NULL,
    is_used            BOOLEAN      NOT NULL DEFAULT FALSE,
    used_at            TIMESTAMP,
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_sessions_ration_card_id ON qr_sessions(ration_card_id);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_expires_at      ON qr_sessions(expires_at);

-- 2.10  otp_verifications  (SMS OTP audit / fallback store)
CREATE TABLE IF NOT EXISTS otp_verifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mobile      VARCHAR(15) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    is_used     BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP   NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_mobile ON otp_verifications(mobile);


-- ---------------------------------------------------------------------------
-- 3. SEED DATA
-- ---------------------------------------------------------------------------

-- 3.1  Entitlement policies  (system cannot function without these)
INSERT INTO policies (category, rice_per_person_kg, wheat_per_person_kg, sugar_per_person_kg, validity_days)
VALUES
    ('APL', 3.00, 2.00, 0.50, 30),
    ('BPL', 5.00, 3.00, 1.00, 30),
    ('AAY', 7.00, 8.00, 1.00, 30)
ON CONFLICT (category) DO NOTHING;

-- 3.2  Default admin user
--      Password: abcd1234  (bcrypt, cost 10)
--      ⚠ CHANGE THIS PASSWORD immediately after first login in production.
INSERT INTO users (role, email, password_hash)
VALUES (
    'admin',
    'admin@pds.gov',
    '$2b$10$zl8a54LjIpIGa9VLyxsPOOG8LDuk9UAfUe4sG4lbWjEAYhId4XY36'
)
ON CONFLICT (email) DO NOTHING;

-- Areas and shops are NOT seeded here.
-- Create them through the admin panel so demo data reflects your actual context.


-- ---------------------------------------------------------------------------
-- 4. USEFUL VIEWS  (read-only, safe to keep in production)
-- ---------------------------------------------------------------------------

-- 4.1  Full beneficiary overview
CREATE OR REPLACE VIEW v_beneficiaries AS
SELECT
    rc.id              AS ration_card_id,
    rc.card_number,
    rc.category,
    rc.is_active,
    fm.name            AS head_name,
    u.mobile,
    s.shop_code,
    s.shop_name,
    a.name             AS area_name,
    w.rice_balance_kg,
    w.wheat_balance_kg,
    w.sugar_balance_kg,
    (
        SELECT COUNT(*) FROM family_members fm2
        WHERE fm2.ration_card_id = rc.id
    )::INT             AS family_size,
    rc.created_at
FROM ration_cards rc
JOIN family_members fm ON fm.ration_card_id = rc.id AND fm.is_head = TRUE
JOIN users u           ON u.id  = fm.user_id
JOIN shops s           ON s.id  = rc.shop_id
JOIN areas a           ON a.id  = rc.area_id
LEFT JOIN wallets w    ON w.ration_card_id = rc.id;

-- 4.2  Transaction history with human-readable context
CREATE OR REPLACE VIEW v_transactions AS
SELECT
    t.id,
    t.created_at,
    rc.card_number,
    rc.category,
    s.shop_name,
    u.name             AS served_by_name,
    t.rice_qty_kg,
    t.wheat_qty_kg,
    t.sugar_qty_kg,
    t.blockchain_tx_hash
FROM transactions t
JOIN ration_cards rc ON rc.id = t.ration_card_id
JOIN shops s         ON s.id  = t.shop_id
LEFT JOIN users u    ON u.id  = t.served_by;

-- 4.3  Shop summary
CREATE OR REPLACE VIEW v_shop_summary AS
SELECT
    s.id,
    s.shop_code,
    s.shop_name,
    a.name             AS area_name,
    u.name             AS shopkeeper_name,
    u.mobile           AS shopkeeper_mobile,
    COUNT(DISTINCT rc.id)::INT  AS total_ration_cards,
    COUNT(DISTINCT t.id)::INT   AS total_transactions
FROM shops s
JOIN areas a              ON a.id = s.area_id
LEFT JOIN users u         ON u.id = s.shopkeeper_id
LEFT JOIN ration_cards rc ON rc.shop_id = s.id
LEFT JOIN transactions t  ON t.shop_id  = s.id
GROUP BY s.id, s.shop_code, s.shop_name, a.name, u.name, u.mobile;


COMMIT;

-- =============================================================================
-- DONE.
-- Tables:  areas, policies, users, shops, ration_cards, family_members,
--          wallets, transactions, qr_sessions, otp_verifications
-- Views:   v_beneficiaries, v_transactions, v_shop_summary
-- Seed:    3 policies · 1 admin (admin@pds.gov / abcd1234)
--          Areas and shops → create via admin panel
-- =============================================================================
CREATE TABLE blockchain_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID NOT NULL REFERENCES transactions(id),
  tx_hash          TEXT,
  status           VARCHAR(20) DEFAULT 'pending',
  -- pending | confirmed | failed
  block_number     BIGINT,
  submitted_at     TIMESTAMP DEFAULT NOW(),
  confirmed_at     TIMESTAMP
);

-- =============================================================================
-- PDS Schema Patch — family_members fix + hardened blockchain_logs
-- PostgreSQL 14+
-- =============================================================================
-- HOW TO USE IN pgAdmin:
--   1. Connect to your `pds` database.
--   2. Tools -> Query Tool.
--   3. Paste this whole file and run (F5).
--   4. It runs in one transaction: all-or-nothing.
--
-- SAFE TO RUN ON EITHER PATH:
--   - migration-based DB (npm run migrate:up): family_members has no bad
--     constraint, so the DROP is a no-op; blockchain_logs likely doesn't exist
--     yet, so it gets created fresh with the hardened definition.
--   - schema.sql-based DB: drops the bad UNIQUE, and upgrades the existing
--     blockchain_logs (adds missing columns/constraints/index) in place.
--   - Idempotent: re-running it changes nothing.
-- =============================================================================

BEGIN;

-- Needed for gen_random_uuid() if the table is created fresh.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- FIX 1: family_members one-member-per-card bug
-- The UNIQUE on ration_card_id (present only in schema.sql) caps a card at one
-- member. Drop it. The UNIQUE on user_id stays (one person = one membership).
-- ---------------------------------------------------------------------------
ALTER TABLE family_members
    DROP CONSTRAINT IF EXISTS family_members_ration_card_id_key;

-- The plain lookup index should remain (recreate if missing).
CREATE INDEX IF NOT EXISTS idx_family_members_ration_card_id
    ON family_members(ration_card_id);


-- ---------------------------------------------------------------------------
-- FIX 2: blockchain_logs — create or harden, INSIDE this transaction
-- ---------------------------------------------------------------------------

-- 2.0  Create with the full hardened shape if it doesn't exist yet.
CREATE TABLE IF NOT EXISTS blockchain_logs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID         NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
    tx_hash         TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    block_number    BIGINT,
    attempts        INTEGER      NOT NULL DEFAULT 0,
    last_error      TEXT,
    submitted_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    confirmed_at    TIMESTAMP
);

-- 2.1  If the table already existed (schema.sql path), add any missing columns.
ALTER TABLE blockchain_logs ADD COLUMN IF NOT EXISTS attempts     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE blockchain_logs ADD COLUMN IF NOT EXISTS last_error   TEXT;
ALTER TABLE blockchain_logs ADD COLUMN IF NOT EXISTS block_number BIGINT;

-- 2.2  Make status NOT NULL with a default, normalising any existing NULLs.
UPDATE blockchain_logs SET status = 'pending' WHERE status IS NULL;
ALTER TABLE blockchain_logs ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE blockchain_logs ALTER COLUMN status SET NOT NULL;

-- 2.3  One log per transaction (UNIQUE also gives an index for lookups).
--      NOTE: errors if duplicate transaction_id rows already exist — clean
--      them first. On a fresh/dev DB the table is empty, so this is fine.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blockchain_logs_transaction_id_key'
    ) THEN
        ALTER TABLE blockchain_logs
            ADD CONSTRAINT blockchain_logs_transaction_id_key UNIQUE (transaction_id);
    END IF;
END $$;

-- 2.4  Restrict status to valid values.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blockchain_logs_status_check'
    ) THEN
        ALTER TABLE blockchain_logs
            ADD CONSTRAINT blockchain_logs_status_check
            CHECK (status IN ('pending', 'confirmed', 'failed'));
    END IF;
END $$;

-- 2.5  Index for the confirmation listener's `WHERE status = 'pending'` poll.
CREATE INDEX IF NOT EXISTS idx_blockchain_logs_status
    ON blockchain_logs(status);

COMMIT;

-- =============================================================================
-- VERIFY (read-only — run these after the patch to confirm)
-- =============================================================================
-- family_members: should NOT list family_members_ration_card_id_key
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'family_members'::regclass AND contype = 'u';
--
-- blockchain_logs: should show the unique + check constraints
--   SELECT conname, contype FROM pg_constraint
--   WHERE conrelid = 'blockchain_logs'::regclass;
--
-- blockchain_logs columns: attempts, last_error should be present
--   \d blockchain_logs
-- =============================================================================
