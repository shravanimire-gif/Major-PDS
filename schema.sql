-- =============================================================================
-- PDS (Public Distribution System) — Production Schema
-- PostgreSQL 14+  |  Regenerated from the live local DB (newpds) — 27 Jul 2026
-- Reflects node-pg-migrate migrations 001 through 020 (fully applied).
-- =============================================================================
-- HOW TO USE IN pgAdmin:
--   1. Connect to your target database (create a fresh one if needed).
--   2. Open Query Tool (Tools → Query Tool).
--   3. Paste this entire file and click ▶ Execute / F5.
--   4. Everything runs in a single transaction — it either all succeeds or
--      rolls back cleanly.
--
-- NOTE: this file is a convenience snapshot for spinning up a database
-- without running migrations (e.g. local onboarding, ad-hoc environments).
-- It does NOT create the `pgmigrations` bookkeeping table, so a DB built
-- from this file is NOT tracked by node-pg-migrate — don't run
-- `npm run migrate:up` against it afterwards without reconciling history.
-- The source of truth for schema changes is pds-backend/migrations/.
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
-- 2. FUNCTIONS
-- ---------------------------------------------------------------------------

-- Blocks deletion of the admin user (by role or by the reserved admin email),
-- even via ad-hoc SQL — application code should be deactivating, not deleting.
CREATE OR REPLACE FUNCTION prevent_admin_user_delete() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.role = 'admin' OR LOWER(COALESCE(OLD.email, '')) = 'admin@pds.gov' THEN
        RAISE EXCEPTION 'Admin users cannot be deleted';
      END IF;
      RETURN OLD;
    END;
    $$;


-- ---------------------------------------------------------------------------
-- 3. CORE TABLES  (order respects foreign-key dependencies)
-- ---------------------------------------------------------------------------

-- 3.1  areas
CREATE TABLE IF NOT EXISTS areas (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100)  NOT NULL UNIQUE,
    is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- 3.2  policies  (entitlement rules per ration category)
CREATE TABLE IF NOT EXISTS policies (
    id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    category             ration_category NOT NULL UNIQUE,
    -- Allocation is PER RATION CARD (per household), per commodity, in
    -- grams -- not per person. Family size does not scale it. The CHECKs make
    -- the domain rule structural: a household's whole allocation for one
    -- commodity must be deliverable by ONE dispensing transaction, so the
    -- policy table cannot physically hold a larger figure. 4000 mirrors
    -- MAX_DISPENSE_TRANSACTION_GRAMS in src/config/allocation.js (SQL cannot
    -- read the JS constant -- change both together); the % 10 rule mirrors
    -- ALLOCATION_GRAMS_STEP and keeps grams <-> NUMERIC(8,2) kg lossless.
    rice_per_card_grams  INTEGER         NOT NULL
        CHECK (rice_per_card_grams  > 0 AND rice_per_card_grams  <= 4000 AND rice_per_card_grams  % 10 = 0),
    wheat_per_card_grams INTEGER         NOT NULL
        CHECK (wheat_per_card_grams > 0 AND wheat_per_card_grams <= 4000 AND wheat_per_card_grams % 10 = 0),
    validity_days        INTEGER         NOT NULL DEFAULT 30,
    updated_at           TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- 3.3  users  (admin / shopkeeper / beneficiary)
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role          user_role   NOT NULL,
    name          VARCHAR(150),
    email         VARCHAR(255) UNIQUE,
    mobile        VARCHAR(15),
    password_hash TEXT,
    address       TEXT,
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    gender        VARCHAR(10),
    age           INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);

DROP TRIGGER IF EXISTS trg_prevent_admin_user_delete ON users;
CREATE TRIGGER trg_prevent_admin_user_delete
    BEFORE DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION prevent_admin_user_delete();

-- 3.4  shops
CREATE TABLE IF NOT EXISTS shops (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_code      VARCHAR(20)  NOT NULL UNIQUE,
    shop_name      VARCHAR(150) NOT NULL,
    area_id        UUID         NOT NULL REFERENCES areas(id)     ON DELETE RESTRICT,
    shopkeeper_id  UUID         UNIQUE   REFERENCES users(id)     ON DELETE SET NULL,
    address        TEXT,
    contact_number VARCHAR(15),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shops_area_id       ON shops(area_id);
CREATE INDEX IF NOT EXISTS idx_shops_shopkeeper_id ON shops(shopkeeper_id);

-- 3.5  ration_cards
CREATE TABLE IF NOT EXISTS ration_cards (
    id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    card_number  VARCHAR(50)     NOT NULL UNIQUE,
    category     ration_category NOT NULL,
    head_user_id UUID            NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
    shop_id      UUID            NOT NULL REFERENCES shops(id)  ON DELETE RESTRICT,
    area_id      UUID            NOT NULL REFERENCES areas(id)  ON DELETE RESTRICT,
    is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP       NOT NULL DEFAULT NOW(),
    address      TEXT
);

CREATE INDEX IF NOT EXISTS idx_ration_cards_shop_id      ON ration_cards(shop_id);
CREATE INDEX IF NOT EXISTS idx_ration_cards_area_id      ON ration_cards(area_id);
CREATE INDEX IF NOT EXISTS idx_ration_cards_head_user_id ON ration_cards(head_user_id);

-- 3.6  family_members
-- NOTE: ration_card_id is intentionally NOT unique — a card can have many
-- members. Only user_id is unique (one person = one membership).
CREATE TABLE IF NOT EXISTS family_members (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ration_card_id UUID         NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
    user_id        UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name           VARCHAR(150) NOT NULL,
    age            INTEGER      NOT NULL CHECK (age >= 0 AND age <= 120),
    is_head        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    relationship   VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_family_members_ration_card_id ON family_members(ration_card_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id        ON family_members(user_id);

-- 3.7  wallets  (one per ration card, holds monthly grain balances)
CREATE TABLE IF NOT EXISTS wallets (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ration_card_id    UUID         NOT NULL UNIQUE REFERENCES ration_cards(id) ON DELETE CASCADE,
    rice_balance_kg   NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (rice_balance_kg >= 0),
    wheat_balance_kg  NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (wheat_balance_kg >= 0),
    last_reset_date   DATE,
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 3.8  transactions  (grain dispense records — immutable audit log)
CREATE TABLE IF NOT EXISTS transactions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ration_card_id      UUID         NOT NULL REFERENCES ration_cards(id) ON DELETE RESTRICT,
    shop_id             UUID         NOT NULL REFERENCES shops(id)        ON DELETE RESTRICT,
    served_by           UUID                  REFERENCES users(id),
    rice_qty_kg         NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (rice_qty_kg >= 0),
    wheat_qty_kg        NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (wheat_qty_kg >= 0),
    blockchain_tx_hash  TEXT,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_ration_card_id ON transactions(ration_card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id        ON transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at     ON transactions(created_at);

-- 3.9  blockchain_logs  (Sepolia anchor status for each transaction)
CREATE TABLE IF NOT EXISTS blockchain_logs (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id  UUID         NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
    tx_hash         TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'failed')),
    block_number    BIGINT,
    attempts        INTEGER      NOT NULL DEFAULT 0,
    last_error      TEXT,
    submitted_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    confirmed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blockchain_logs_status         ON blockchain_logs(status);
CREATE INDEX IF NOT EXISTS idx_blockchain_logs_transaction_id ON blockchain_logs(transaction_id);

-- 3.10  qr_sessions  (short-lived QR tokens for beneficiary → shopkeeper flow)
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
CREATE INDEX IF NOT EXISTS idx_qr_sessions_expires_at     ON qr_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_shop_id        ON qr_sessions(shop_id);

-- 3.11  otp_verifications  (SMS OTP audit / fallback store)
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
-- 4. IOT / SMART-DISPENSER TABLES
-- ---------------------------------------------------------------------------

-- 4.1  iot_devices  (one smart dispenser per shop, token-authenticated)
CREATE TABLE IF NOT EXISTS iot_devices (
    id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The stable hardware identity. For the USB/serial ESP32 this is derived
    -- from the chip's factory MAC (ESP32-XXXXXX) and reported by the firmware
    -- itself, so it survives reflashes and COM-port renumbering. A COM port is
    -- never an identity.
    device_id                  VARCHAR(100) NOT NULL UNIQUE,
    device_token_hash          TEXT         NOT NULL,
    -- NULLable: an unassigned device is registered but inert. The /ws/iot
    -- handshake rejects it, so device.shop_id === session.shop_id can never be
    -- satisfied by a NULL. See migration 026.
    shop_id                    UUID         REFERENCES shops(id) ON DELETE CASCADE,
    status                     VARCHAR(20)  NOT NULL DEFAULT 'active',
    token_expires_at           TIMESTAMP,
    last_seen_at               TIMESTAMP,
    created_at                 TIMESTAMP    NOT NULL DEFAULT NOW(),
    needs_recalibration        BOOLEAN      NOT NULL DEFAULT FALSE,
    calibrated_at              TIMESTAMP,
    previous_token_hash        TEXT,
    previous_token_expires_at  TIMESTAMP,
    -- Human label shown in the Admin Panel; falls back to device_id when NULL.
    device_name                VARCHAR(150),
    -- Reported by the device in its serial `hello` frame, relayed by the IoT
    -- bridge. Never admin-supplied, so it always describes the running binary.
    firmware_version           VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_shop_id ON iot_devices(shop_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_status  ON iot_devices(status);

-- 4.2  sensor_readings  (raw weight samples streamed from a device)
CREATE TABLE IF NOT EXISTS sensor_readings (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   VARCHAR(100) NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,
    grams_int   INTEGER      NOT NULL,
    taken_at    TIMESTAMP    NOT NULL,
    session_id  VARCHAR(150),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_id ON sensor_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_taken_at  ON sensor_readings(taken_at);

-- 4.3  sensor_reading_rejections  (readings rejected by validation, for diagnostics)
CREATE TABLE IF NOT EXISTS sensor_reading_rejections (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id    VARCHAR(100) NOT NULL REFERENCES iot_devices(device_id) ON DELETE CASCADE,
    rejected_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_reading_rejections_device_id_rejected_at
    ON sensor_reading_rejections(device_id, rejected_at);

-- 4.4  iot_audit  (append-only audit trail for device/admin actions)
CREATE TABLE IF NOT EXISTS iot_audit (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type  VARCHAR(20) NOT NULL,
    actor_id    UUID,
    action      VARCHAR(50) NOT NULL,
    target      TEXT        NOT NULL,
    at_time     TIMESTAMP   NOT NULL DEFAULT NOW(),
    meta_json   JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_iot_audit_action  ON iot_audit(action);
CREATE INDEX IF NOT EXISTS idx_iot_audit_at_time ON iot_audit(at_time);

-- 4.5  commodity_tolerances  (per-commodity weight tolerance for dispensing)
--      Answers "how much measurement deviation is acceptable around the
--      intended quantity?" — distinct from the business allocation ceiling
--      (config/allocation.js) and from the load cell's safety ceiling
--      (config/iot.js). tolerance_grams = GREATEST(min_tolerance_grams,
--      ROUND(entitled_grams * tolerance_pct / 100)).
--      The PRIMARY KEY already prevents duplicate configuration per commodity.
CREATE TABLE IF NOT EXISTS commodity_tolerances (
    commodity            VARCHAR(20)  PRIMARY KEY
        CHECK (commodity IN ('rice', 'wheat')),
    min_tolerance_grams   INTEGER      NOT NULL DEFAULT 20
        CHECK (min_tolerance_grams > 0 AND min_tolerance_grams <= 500),
    tolerance_pct         NUMERIC(5,2) NOT NULL DEFAULT 1
        CHECK (tolerance_pct > 0 AND tolerance_pct <= 100)
);

-- 4.6  dispense_sessions  (an open weighing session at a shop's dispenser)
CREATE TABLE IF NOT EXISTS dispense_sessions (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id          UUID         NOT NULL REFERENCES shops(id)        ON DELETE CASCADE,
    ration_card_id   UUID         NOT NULL REFERENCES ration_cards(id) ON DELETE CASCADE,
    commodity        VARCHAR(20)  NOT NULL,
    entitled_grams   INTEGER      NOT NULL,
    tolerance_grams  INTEGER      NOT NULL,
    device_id        VARCHAR(100) REFERENCES iot_devices(device_id) ON DELETE SET NULL,
    state            VARCHAR(30)  NOT NULL DEFAULT 'active',
    opened_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    expires_at       TIMESTAMP    NOT NULL,
    attached_at      TIMESTAMP,
    committed_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispense_sessions_shop_id        ON dispense_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_dispense_sessions_ration_card_id ON dispense_sessions(ration_card_id);
CREATE INDEX IF NOT EXISTS idx_dispense_sessions_device_id_state ON dispense_sessions(device_id, state);

-- 4.7  dispense_records  (committed, hash-chained dispense outcome)
CREATE TABLE IF NOT EXISTS dispense_records (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID         NOT NULL UNIQUE REFERENCES dispense_sessions(id) ON DELETE RESTRICT,
    ration_card_id      UUID         NOT NULL REFERENCES ration_cards(id) ON DELETE RESTRICT,
    shop_id             UUID         NOT NULL REFERENCES shops(id)        ON DELETE RESTRICT,
    commodity           VARCHAR(20)  NOT NULL,
    entitled_grams      INTEGER      NOT NULL,
    measured_grams      INTEGER      NOT NULL,
    prev_hash           TEXT,
    row_hash            TEXT         NOT NULL,
    committed_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    blockchain_tx_hash  TEXT,
    last_anchor_error   TEXT,
    -- The canonical business transaction this IoT dispense produced.
    -- Written by dispenseSessionService.commitSession in the same PostgreSQL
    -- transaction as the wallet debit, so analytics / anomaly detection /
    -- the activity feed (which all read `transactions`) see IoT dispenses.
    -- Nullable: manual dispenses have no dispense_record, and IoT records
    -- committed before this link existed keep NULL.
    transaction_id      UUID         REFERENCES transactions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_dispense_records_ration_card_id ON dispense_records(ration_card_id);
-- One business transaction per IoT dispense. Partial so legacy NULLs coexist.
CREATE UNIQUE INDEX IF NOT EXISTS dispense_records_transaction_id_unique_index
    ON dispense_records(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispense_records_shop_id_committed_at
    ON dispense_records(shop_id, committed_at);

-- 4.8  used_jtis  (replay protection for dispense-session JWTs)
CREATE TABLE IF NOT EXISTS used_jtis (
    jti         TEXT      PRIMARY KEY,
    session_id  UUID      NOT NULL REFERENCES dispense_sessions(id) ON DELETE CASCADE,
    used_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4.8b anomaly_events  (seed detector output — see jobs/anomalyDetectionCron.js)
--      Created by migrations/005_add_anomaly_events.js but was missing from
--      this file, so a schema.sql-bootstrapped database had no such table and
--      both the activity feed (activityFeedService._getAnomalyEvents) and the
--      anomaly cron failed against it. Kept in sync with that migration.
CREATE TABLE IF NOT EXISTS anomaly_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(50) NOT NULL,
    severity        VARCHAR(20) NOT NULL,   -- 'info' | 'warning' | 'critical'
    shop_code       VARCHAR(20),
    transaction_id  UUID        REFERENCES transactions(id) ON DELETE SET NULL,
    description     TEXT        NOT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    resolved        BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_anomaly_events_created_at     ON anomaly_events(created_at);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_resolved       ON anomaly_events(resolved);
CREATE INDEX IF NOT EXISTS idx_anomaly_events_transaction_id ON anomaly_events(transaction_id);


-- 4.9  anomaly_rules  (configurable anomaly-detection rule definitions)
CREATE TABLE IF NOT EXISTS anomaly_rules (
    rule_key     VARCHAR(50) PRIMARY KEY,
    enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
    severity     VARCHAR(20) NOT NULL,
    params_json  JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- 4.10  anomaly_flags  (raised anomalies against shops/devices/dispenses)
CREATE TABLE IF NOT EXISTS anomaly_flags (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key             VARCHAR(50)  NOT NULL REFERENCES anomaly_rules(rule_key)     ON DELETE RESTRICT,
    shop_id              UUID         NOT NULL REFERENCES shops(id)                   ON DELETE CASCADE,
    device_id            VARCHAR(100) REFERENCES iot_devices(device_id)               ON DELETE SET NULL,
    dispense_record_id   UUID         REFERENCES dispense_records(id)                 ON DELETE SET NULL,
    severity             VARCHAR(20)  NOT NULL,
    description          TEXT         NOT NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    resolved_at          TIMESTAMP,
    auto_resolved_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anomaly_flags_rule_key ON anomaly_flags(rule_key);
CREATE INDEX IF NOT EXISTS idx_anomaly_flags_shop_id  ON anomaly_flags(shop_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_flags_resolved_at_auto_resolved_at
    ON anomaly_flags(resolved_at, auto_resolved_at);


-- ---------------------------------------------------------------------------
-- 5. SEED DATA
-- ---------------------------------------------------------------------------

-- 5.1  Entitlement policies  (system cannot function without these)
--      Per-card monthly allocation in grams. Category differentiation is
--      preserved (APL < BPL < AAY, as before); every figure is <= 4000 g so a
--      card's whole allocation for a commodity completes in one transaction.
INSERT INTO policies (category, rice_per_card_grams, wheat_per_card_grams, validity_days)
VALUES
    ('APL', 2000, 1500, 30),
    ('BPL', 3000, 2000, 30),
    ('AAY', 4000, 3000, 30)
ON CONFLICT (category) DO NOTHING;

-- 5.2  Commodity dispensing tolerances  (REQUIRED — the application fails
--      closed without these; see dispenseSessionService.computeToleranceGrams)
--      Values match migrations/011 and 024. Seeded here because a database
--      built from this file alone previously had an empty table, which made
--      physical dispensing tolerance depend on whether migrations had run.
INSERT INTO commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct)
VALUES
    ('rice', 20, 1.00),
    ('wheat', 20, 1.00)
ON CONFLICT (commodity) DO NOTHING;

-- 5.3  Default admin user
--      Password: abcd1234  (bcrypt, cost 10)
--      ⚠ CHANGE THIS PASSWORD immediately after first login in production.
INSERT INTO users (role, email, password_hash)
VALUES (
    'admin',
    'admin@pds.gov',
    '$2b$10$zl8a54LjIpIGa9VLyxsPOOG8LDuk9UAfUe4sG4lbWjEAYhId4XY36'
)
ON CONFLICT (email) DO NOTHING;

-- Areas, shops, IoT devices, and anomaly rules are NOT seeded here.
-- Create them through the admin panel / app so demo data reflects your context.


-- ---------------------------------------------------------------------------
-- 6. USEFUL VIEWS  (read-only, safe to keep in production)
-- ---------------------------------------------------------------------------

-- 6.1  Full beneficiary overview
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

-- 6.2  Transaction history with human-readable context + blockchain status
CREATE OR REPLACE VIEW v_transactions AS
SELECT
    t.id,
    t.created_at,
    rc.card_number,
    rc.category,
    s.shop_name,
    u.name                    AS served_by_name,
    t.rice_qty_kg,
    t.wheat_qty_kg,
    t.blockchain_tx_hash,
    bl.status                 AS blockchain_status,
    bl.confirmed_at           AS blockchain_confirmed_at
FROM transactions t
JOIN ration_cards rc       ON rc.id = t.ration_card_id
JOIN shops s               ON s.id  = t.shop_id
LEFT JOIN users u          ON u.id  = t.served_by
LEFT JOIN blockchain_logs bl ON bl.transaction_id = t.id;

-- 6.3  Shop summary
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

-- 6.4  Blockchain anchors still awaiting confirmation
CREATE OR REPLACE VIEW v_blockchain_pending AS
SELECT
    bl.id,
    bl.transaction_id,
    bl.tx_hash,
    bl.attempts,
    bl.last_error,
    bl.submitted_at,
    t.ration_card_id,
    t.shop_id,
    t.rice_qty_kg,
    t.wheat_qty_kg,
    t.created_at       AS transaction_date
FROM blockchain_logs bl
JOIN transactions t ON t.id = bl.transaction_id
WHERE bl.status = 'pending'
ORDER BY bl.submitted_at;


COMMIT;

-- =============================================================================
-- DONE.
-- Tables:  areas, policies, users, shops, ration_cards, family_members,
--          wallets, transactions, blockchain_logs, qr_sessions,
--          otp_verifications, iot_devices, sensor_readings,
--          sensor_reading_rejections, iot_audit, commodity_tolerances,
--          dispense_sessions, dispense_records, used_jtis, anomaly_events,
--          anomaly_rules,
--          anomaly_flags
-- Views:   v_beneficiaries, v_transactions, v_shop_summary, v_blockchain_pending
-- Seed:    3 policies · 2 commodity tolerances · 1 admin (admin@pds.gov / abcd1234)
--          Areas, shops, IoT devices → create via admin panel
-- =============================================================================
