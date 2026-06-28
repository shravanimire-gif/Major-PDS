# Software Test Case Document
## Blockchain-Based Public Distribution System (PDS) with IoT Integration

**Project:** Blockchain-Based PDS — Web (Admin + Shopkeeper) & Mobile (Beneficiary)
**Developer:** Himanshu Mire
**Institution:** St. Vincent Pallotti College of Engineering and Technology, Nagpur
**Document type:** Functional / Manual Test Cases (Project-I)
**Date:** 2026-06-27

---

## 1. Purpose

This document defines manual functional test cases to verify that each module of the PDS
application behaves as expected. It is intended to be executed by hand against a running local
instance, with the *Actual Result* and *Status* columns filled in during a test run. It also
serves as a verification reference for the project report and viva.

These are black-box / functional cases written against the API contract and business rules — they
do not require reading the source. Wherever a case depends on seeded values (a specific ration
card ID, a shop ID, an OTP), substitute the real value from your database at run time.

---

## 2. Environment under test

> Values confirmed against the actual repo files.

| Item | Value |
|---|---|
| Backend base URL | `http://localhost:5000` (default from `server.js`; set `PORT=5055` in `.env` only if you want the Render production port locally) |
| Frontend URL | `http://localhost:5174` (hardcoded in `vite.config.js` with `strictPort: true`) |
| Database name | `pds` (local dev) |
| OTP provider | **Twilio Verify only** — no local/console fallback; requires real credentials and a reachable phone |
| Seed data | **3 policies (APL/BPL/AAY) + 1 admin + 3 areas + 9 shops** — policies and admin from `seed-admin.js`, areas/shops from `seed.js` |
| Admin login | `admin@pds.gov` / `admin123` ¹ |

> ¹ **Password note.** Two sources exist with conflicting passwords:
> `seed-admin.js` (`npm run seed:admin`) dynamically hashes **`admin123`** — this is what
> the pre-test setup runs, so `admin123` is the live password after setup.
> `schema.sql` contains a hardcoded bcrypt hash with a comment saying `abcd1234`.
> If you import `schema.sql` directly instead of running migrations + seed, the password is
> `abcd1234`. The test cases below use **`admin123`** because the setup instructions use
> `npm run seed:admin`.

> **Seed coverage.** After running the full setup (`migrate:up` + `seed:admin` + `seed`):
> - ✅ 3 entitlement policies (APL/BPL/AAY)
> - ✅ 1 admin user (`admin@pds.gov`)
> - ✅ 3 areas: Dharampeth (DHP), Sadar (SDR), Manewada (MNW)
> - ✅ 9 shops (3 per area, codes DHP-001…MNW-003) — no shopkeeper assigned yet
> - ❌ No ration cards, wallets, beneficiaries, or shopkeeper accounts

### Pre-test setup (must be done before *any* case below)

Nothing is running by default — there is no committed `.env` and the local DB is not seeded.
Before executing test cases:

1. Create `pds-backend/.env` from `.env.example` (`DATABASE_URL` → local `pds` DB, `JWT_SECRET`,
   all four `TWILIO_*` values, `NODE_ENV=development`).
2. Create `pds-frontend/.env` with `VITE_API_BASE_URL=http://localhost:5000`.
3. `createdb pds && cd pds-backend && npm run migrate:up && npm run seed:admin && npm run seed`
4. **Apply the schema fix** in Module M0a (the `family_members` constraint) — without it, any
   card with more than one family member fails to create.
5. Start backend (`npm run dev`, terminal 1) and frontend (`npm run dev`, terminal 2).
6. Create shopkeeper users and ration cards (Module M0b) through the admin panel/API.

A smoke check confirming the above is **TC-ENV-01 / 02** below; if those fail, stop and fix the
environment before running anything else.

### Legend
- **Status values:** Pass / Fail / Blocked / Not Run
- **Tools:** Postman (API cases), browser (UI cases), pgAdmin/psql (DB verification), real phone (OTP)

---

## 3. Module index

| # | Module | Prefix | Layer |
|---|---|---|---|
| M0 | Environment & smoke | TC-ENV | Setup |
| M0a | Schema fixes & integrity | TC-SCHEMA | DB |
| M0b | Test data fixture build | TC-FIX | Setup |
| M1 | Authentication (email/password) | TC-AUTH | Backend + UI |
| M2 | OTP authentication (Twilio) | TC-OTP | Backend |
| M3 | Role-based access control | TC-RBAC | Backend + UI |
| M4 | Admin — Areas | TC-AREA | Backend + UI |
| M5 | Admin — Shops & shopkeeper assignment | TC-SHOP | Backend + UI |
| M6 | Admin — Ration card creation (atomic) | TC-CARD | Backend + UI |
| M7 | Admin — Beneficiaries & users | TC-BEN | Backend + UI |
| M8 | Entitlement engine | TC-ENT | Backend |
| M9 | Wallet | TC-WAL | Backend |
| M10 | QR session flow | TC-QR | Backend + UI |
| M11 | Shopkeeper — lookup & dispense | TC-DISP | Backend + UI |
| M12 | Double-claim & cross-shop prevention | TC-GUARD | Backend |
| M13 | Pre-blockchain validation dashboard | TC-VAL | Backend + UI |
| M14 | Security hardening | TC-SEC | Backend |
| M15 | Scheduled jobs (cron) | TC-CRON | Backend |
| M16 | Blockchain readiness (schema-level) | TC-CHAIN | DB |

---

## M0 — Environment & Smoke

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-ENV-01 | Backend starts with valid `.env` | Start `npm run dev` in `pds-backend` with all required env vars set | Server boots, listens on `:5000`, `validateEnvironment()` passes (no "Missing required environment variables" error) | | |
| TC-ENV-02 | Backend refuses to start with missing env | Remove `JWT_SECRET` from `.env`, start backend | Startup fails immediately with a clear "Missing required environment variables" message; process exits | | |
| TC-ENV-03 | Frontend reaches backend | Start frontend, open `http://localhost:5174`, watch network tab on login | Requests go to `http://localhost:5000/...`, **not** `undefined/...` | | |
| TC-ENV-04 | CORS allows the dev origin | From `:5174`, hit any `:5000` API | No CORS error in console; preflight passes for `http://localhost:5174` | | |
| TC-ENV-05 | DB seeded correctly | `psql -d pds`, query `users`, `policies`, `areas`, `shops` | Admin user exists; exactly 3 policy rows (APL/BPL/AAY); 3 area rows (Dharampeth, Sadar, Manewada); 9 shop rows (3 per area, no shopkeeper assigned); **no ration cards or wallets** | | |

---

## M0a — Schema Fixes & Integrity

> Run these against the live schema **before** building fixtures. TC-SCHEMA-01 identifies a
> blocking defect in `schema.sql` — without the fix, any multi-member ration card fails to create
> and entitlement scaling is impossible.
>
> **Schema path note.** The migration file `001_initial_schema.js` does NOT put a UNIQUE
> constraint on `family_members.ration_card_id`, so this bug is specific to `schema.sql`.
> If you used `npm run migrate:up` (recommended setup), verify whether the constraint exists
> before running TC-SCHEMA-01; it may already be absent and no fix is needed on that path.

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-SCHEMA-01 | **family_members one-per-card bug** | On the `schema.sql`-based DB, insert 2 `family_members` rows for the same `ration_card_id` | Second insert is **rejected** by `family_members_ration_card_id_key` UNIQUE — confirming the bug exists; on the migration-based DB this insert succeeds (no bug) | | |
| TC-SCHEMA-02 | Apply the fix (schema.sql path only) | Run `ALTER TABLE family_members DROP CONSTRAINT family_members_ration_card_id_key;` | Constraint dropped; `idx_family_members_ration_card_id` index still present | | |
| TC-SCHEMA-03 | Multi-member insert works after fix | After TC-SCHEMA-02 (or on migration-based DB), insert head + 3 members for one card | All 4 rows persist | | |
| TC-SCHEMA-04 | user_id uniqueness preserved | Insert two `family_members` rows with the same `user_id` | Rejected — one person cannot belong to two cards (this UNIQUE is correct, keep it) | | |
| TC-SCHEMA-05 | AAY policy values confirmed | Query `SELECT * FROM policies WHERE category = 'AAY'` | **rice 7.00 kg/person, wheat 8.00 kg/person, sugar 1.00 kg/person** — per-person rule, not flat 35 kg. This is seeded by both `schema.sql` and `seed-admin.js`. | | |
| TC-SCHEMA-06 | All policy values match spec | Query `policies` table | APL: rice 3, wheat 2, sugar 0.5; BPL: rice 5, wheat 3, sugar 1; AAY: rice 7, wheat 8, sugar 1 (all per-person, per kg) | | |

---

## M0b — Test Data Fixture Build

> After setup: 3 areas and 9 shops already exist from `seed.js`. Shopkeeper accounts and ration
> cards must be created through the admin panel. Record generated UUIDs for reuse in Postman.

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual (record IDs) | Status |
|---|---|---|---|---|---|
| TC-FIX-01 | Areas exist from seed | `GET /api/admin/areas` | Dharampeth, Sadar, Manewada already present; no manual creation needed | area IDs: | |
| TC-FIX-02 | Shops exist from seed | `GET /api/admin/shops` | 9 shops (DHP-001..003, SDR-001..003, MNW-001..003) present; all unassigned | shop IDs: | |
| TC-FIX-03 | Create shopkeepers | `POST /api/admin/shopkeepers` for Shop A and Shop B | Two shopkeeper accounts created, each linked to one shop | shopkeeper creds: | |
| TC-FIX-04 | Create BPL card (4 members) | Head + 3 members, BPL, Shop A | Card + 4 `family_members` rows + 1 wallet created in one transaction (requires TC-SCHEMA-02 or migration-based DB) | card/wallet IDs: | |
| TC-FIX-05 | Create APL card (2 members) | Head + 1 member, APL, Shop A | Card + 2 members + wallet | card ID: | |
| TC-FIX-06 | Create AAY card (5 members) | Head + 4 members, AAY, Shop B | Card + 5 members + wallet | card ID: | |
| TC-FIX-07 | Allocate entitlements | `POST /api/admin/entitlements/allocate` | All fixture wallets populated to category amounts | | |

---

## M1 — Authentication (email / password)

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-AUTH-01 | Valid admin login | `POST /auth/login` `{"email":"admin@pds.gov","password":"admin123"}` | 200; JWT returned; payload contains `role: admin` | | |
| TC-AUTH-02 | Valid shopkeeper login | Login with a shopkeeper credential created in TC-FIX-03 | 200; JWT with `role: shopkeeper` | | |
| TC-AUTH-03 | Wrong password | `admin@pds.gov` + `wrongpass` | 401 Unauthorized; no token; generic error (no "user exists" leak) | | |
| TC-AUTH-04 | Unknown email | `nobody@pds.gov` + any password | 401; same generic message as TC-AUTH-03 (no user-enumeration difference) | | |
| TC-AUTH-05 | Missing fields | `POST /auth/login` with empty body | 400 Joi validation error listing required fields | | |
| TC-AUTH-06 | Password is hashed | Inspect `users` row in DB | `password_hash` is a bcrypt hash, never plaintext | | |
| TC-AUTH-07 | Token stored on web | Login via UI | JWT saved as `pds_token` (localStorage); subsequent calls send `Authorization: Bearer` | | |
| TC-AUTH-08 | Role-based redirect | Login as admin, then as shopkeeper | Admin → `/admin/dashboard`; Shopkeeper → `/shopkeeper/dashboard` | | |
| TC-AUTH-09 | Token expiry value | Decode the JWT | `exp` ≈ 7 days from issue | | |
| TC-AUTH-10 | Tampered token rejected | Alter one character of a valid JWT, call a protected route | 401; signature verification fails | | |

---

## M2 — OTP Authentication (Twilio, beneficiary)

> Twilio-only — there is no local/console fallback, so these require valid Twilio credentials and a
> real reachable phone number.

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-OTP-01 | Send OTP to valid mobile | `POST /auth/otp/send` `{"mobile":"<registered beneficiary>"}` | 200; Twilio Verify sends SMS; an `otp_verifications` audit row is created | | |
| TC-OTP-02 | Verify correct OTP | `POST /auth/otp/verify` `{"mobile":"...", "otp":"<received code>"}` | 200; JWT returned with `role: beneficiary` | | |
| TC-OTP-03 | Verify wrong OTP | Submit an incorrect code | 400/401; no token issued | | |
| TC-OTP-04 | OTP reuse blocked | Verify the same code twice | Second attempt rejected (reuse prevention) | | |
| TC-OTP-05 | Expired OTP | Wait past 10-minute validity (`expires_at DEFAULT NOW() + INTERVAL '10 minutes'`), then verify | Rejected as expired | | |
| TC-OTP-06 | Invalid mobile format | `"mobile":"12abc"` | 400 Joi validation error; no Twilio call made | | |
| TC-OTP-07 | Unregistered mobile | Send to a number with no beneficiary user | Handled gracefully (no JWT, no crash) — confirm intended behaviour matches spec | | |
| TC-OTP-08 | Twilio failure handling | Temporarily use a bad `TWILIO_SERVICE_SID` | Backend returns a clean 5xx/handled error, not an unhandled crash | | |

---

## M3 — Role-Based Access Control (RBAC)

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-RBAC-01 | Protected route without token | `GET /api/admin/areas` with no Authorization header | 401 Unauthorized | | |
| TC-RBAC-02 | Shopkeeper hits admin route | Shopkeeper JWT → `GET /api/admin/users` | 403 Forbidden | | |
| TC-RBAC-03 | Beneficiary hits shopkeeper route | Beneficiary JWT → `POST /api/shopkeeper/dispense` | 403 Forbidden | | |
| TC-RBAC-04 | Admin hits shopkeeper route | Admin JWT → `GET /api/shopkeeper/me` | 403 (admin is not a shopkeeper) — confirm against intended policy | | |
| TC-RBAC-05 | UI route guard | Logged-in shopkeeper navigates to `/admin/dashboard` URL directly | Redirected to `/unauthorized` (ProtectedRoute blocks) | | |
| TC-RBAC-06 | UI guard when logged out | Visit `/admin/users` with no token | Redirected to `/login` | | |

---

## M4 — Admin: Areas

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-AREA-01 | List areas with counts | `GET /api/admin/areas` (admin JWT) | 200; areas returned each with shop/beneficiary counts | | |
| TC-AREA-02 | Nagpur areas present from seed | Inspect list after setup | Dharampeth, Sadar, Manewada present (seeded by `seed.js`); no Gujarat areas | | |
| TC-AREA-03 | Create additional area via panel | Admin UI → add a new area | Area persisted; appears in `/api/admin/areas` list | | |
| TC-AREA-04 | Duplicate area name | Create an area with an existing name | Rejected (unique constraint on `areas.name`) | | |
| TC-AREA-05 | Counts accuracy | Add a shop to an area, refresh | Area's shop count increments by 1 | | |

---

## M5 — Admin: Shops & Shopkeeper Assignment

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-SHOP-01 | List shops with shopkeeper info | `GET /api/admin/shops` | 200; 9 seeded shops shown; each shows assigned shopkeeper (null for all until TC-FIX-03) | | |
| TC-SHOP-02 | Filter unassigned shops | `GET /api/admin/shops?unassigned=true` | All 9 seeded shops returned (before shopkeepers assigned) | | |
| TC-SHOP-03 | Create shopkeeper + assign | `POST /api/admin/shopkeepers` with shop id | Shopkeeper user created and linked to exactly one shop | | |
| TC-SHOP-04 | One shopkeeper per shop | Assign a second shopkeeper to an already-assigned shop | Rejected — `shops.shopkeeper_id` has a UNIQUE constraint | | |
| TC-SHOP-05 | Area→shop cascade in UI | In ration-card form, pick an area | Shop dropdown shows only shops in that area | | |
| TC-SHOP-06 | Shop belongs to an area | Inspect a created shop | `area_id` set; `NOT NULL` enforced by schema | | |

---

## M6 — Admin: Ration Card Creation (atomic 7-step transaction)

> This is the highest-value module to test — one API call performs multiple DB operations and must
> fully roll back on any failure.
>
> **Precondition:** TC-SCHEMA-02 (drop `family_members_ration_card_id_key`) must be applied first
> **if using schema.sql**. On the migration-based DB the constraint does not exist and no fix is
> needed.

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-CARD-01 | Create card with head only | `POST /api/admin/ration-cards`, 1 head, BPL, valid shop | 201; card + head user + wallet created in one transaction | | |
| TC-CARD-02 | Create card with N members | Head + 3 members, APL | Card, head user, 3 member user rows, `family_members` rows, and 1 wallet all created | | |
| TC-CARD-03 | Wallet pre-computed (BPL, 4 members) | 4-member BPL card | Wallet = rice 20 kg, wheat 12 kg, sugar 4 kg (5/3/1 × 4) | | |
| TC-CARD-04 | Wallet pre-computed (APL, 2 members) | 2-member APL card | Wallet = rice 6 kg, wheat 4 kg, sugar 1 kg (3/2/0.5 × 2) | | |
| TC-CARD-05 | Wallet pre-computed (AAY, 5 members) | 5-member AAY card | rice = 35 kg (7×5), wheat = 40 kg (8×5), sugar = 5 kg (1×5) — per-person rule confirmed by schema policy seed | | |
| TC-CARD-05b | AAY per-person rule confirmed | 6-member AAY card | rice = **42 kg** (7×6), wheat = 48 kg, sugar = 6 kg — flat-35-kg rule would give 35 kg; getting 42 confirms per-person | | |
| TC-CARD-06 | Duplicate card number | Create a card with an existing `card_number` | 400; nothing inserted (UNIQUE on `ration_cards.card_number`) | | |
| TC-CARD-07 | Rollback on mid-failure | Force a failure (e.g. invalid member payload after head created) | **No partial rows** — head user, card, members, wallet all absent (full rollback) | | |
| TC-CARD-08 | Invalid category | `category: "XYZ"` | 400 Joi/policy error; no DB writes | | |
| TC-CARD-09 | Area derived from shop | Create card, inspect DB row | `ration_cards.area_id` matches the chosen shop's `area_id` (not entered manually) | | |
| TC-CARD-10 | Paginated list | `GET /api/admin/ration-cards?page=2` | 200; correct page slice and total count | | |
| TC-CARD-11 | Member linked to users table | Inspect a `family_members` row | Each row has a `user_id` that exists in `users`; `user_id` UNIQUE enforced | | |

---

## M7 — Admin: Beneficiaries & Users

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-BEN-01 | List beneficiaries | `GET /api/admin/beneficiaries` | 200; beneficiary overview including wallet balances (uses `v_beneficiaries` view) | | |
| TC-BEN-02 | Filter by category | `?category=AAY` | Only AAY beneficiaries returned | | |
| TC-BEN-03 | Filter by area | `?area=<id>` | Only that area's beneficiaries | | |
| TC-BEN-04 | Filter by shop | `?shop=<id>` | Only that shop's beneficiaries | | |
| TC-BEN-05 | Combined filters | `?category=BPL&area=<id>` | Intersection returned correctly | | |
| TC-BEN-06 | Users by role | `GET /api/admin/users?role=shopkeeper` | Only shopkeeper users | | |
| TC-BEN-07 | Add shopkeeper via modal | Admin UI → Users → Add Shopkeeper | New row appears with `role: shopkeeper` | | |

---

## M8 — Entitlement Engine

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-ENT-01 | Preview without saving | `GET /api/admin/entitlements/preview` | 200; computed allocations returned; **wallets unchanged** in DB | | |
| TC-ENT-02 | Allocate resets wallets | `POST /api/admin/entitlements/allocate` | 200; every wallet reset to its category entitlement | | |
| TC-ENT-03 | AAY rice rule on allocate | After allocate, inspect a 5-member AAY wallet | rice = 35 kg (7 × 5), wheat = 40 kg, sugar = 5 kg — per-person rule from policy table | | |
| TC-ENT-04 | BPL/APL scale with family size | After allocate | Allocations = policy_value × family_size for both categories | | |
| TC-ENT-05 | Idempotency (same day) | Run allocate twice on the same day | Second run skipped automatically; no double reset | | |
| TC-ENT-06 | Preview matches allocate | Compare preview output to post-allocate wallets | Values identical | | |
| TC-ENT-07 | Allocate is admin-only | Shopkeeper JWT → allocate | 403 Forbidden | | |

---

## M9 — Wallet

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-WAL-01 | One wallet per card | Query `wallets` | Exactly one wallet row per `ration_card`; UNIQUE on `wallets.ration_card_id` enforced | | |
| TC-WAL-02 | Balance never negative | After a dispense | Balances ≥ 0; no wallet row with a negative value | | |
| TC-WAL-03 | Wallet visible to shopkeeper | Shopkeeper looks up an assigned beneficiary | Current rice/wheat/sugar balance returned | | |
| TC-WAL-04 | Wallet visible to beneficiary | Beneficiary app after OTP login | Beneficiary sees own balance only | | |
| TC-WAL-05 | Deduction on dispense | Dispense 5 kg rice from a 20 kg wallet | `rice_balance_kg` = 15 kg afterwards | | |

---

## M10 — QR Session Flow

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-QR-01 | Generate QR (beneficiary) | Beneficiary app generates a QR | Short-lived token created in `qr_sessions`; QR rendered | | |
| TC-QR-02 | Scan resolves beneficiary | Shopkeeper scans the QR (`@zxing`) | Correct `ration_card_id` decoded; beneficiary loaded | | |
| TC-QR-03 | Expired QR rejected | Wait past token TTL (`expires_at`), then scan | Rejected as expired/invalid | | |
| TC-QR-04 | Reused QR | Scan a one-time token twice | Second scan rejected (`is_used = TRUE` after first) | | |
| TC-QR-05 | Garbage QR | Scan an unrelated/random QR | Graceful "invalid code" message, no crash | | |

---

## M11 — Shopkeeper: Lookup & Dispense

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-DISP-01 | Get own shop info | `GET /api/shopkeeper/me` | 200; the shopkeeper's single assigned shop | | |
| TC-DISP-02 | Lookup assigned beneficiary | `GET /api/shopkeeper/beneficiary/:id` for own-shop card | 200; wallet + family info | | |
| TC-DISP-03 | Successful dispense | `POST /api/shopkeeper/dispense` rice 5 kg for an eligible card | 200; wallet deducted; transaction row written | | |
| TC-DISP-04 | Transaction recorded | Inspect `transactions` after TC-DISP-03 | Row has `ration_card_id`, `shop_id`, quantities, `created_at`, `served_by` set, `blockchain_tx_hash` NULL | | |
| TC-DISP-05 | Stable txn endpoint | `POST /api/shopkeeper/transactions` | Behaves as blockchain-ready endpoint per spec | | |
| TC-DISP-06 | Over-dispense | Dispense more than wallet balance | Rejected; wallet unchanged; no transaction row | | |
| TC-DISP-07 | UI scan flow states | In `/shopkeeper/scan` | States progress: Scanning → Beneficiary Loaded → Confirm → Success | | |
| TC-DISP-08 | served_by always set | Inspect `transactions` rows | No rows with `served_by = NULL`; anonymous transactions impossible | | |

---

## M12 — Double-Claim & Cross-Shop Prevention

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-GUARD-01 | Second claim same month | Dispense once, then attempt a second dispense same calendar month | 400 "Already claimed this month"; wallet unchanged | | |
| TC-GUARD-02 | New month allows claim | Simulate a transaction dated last month, then dispense this month | Allowed (monthly window resets) | | |
| TC-GUARD-03 | Cross-shop blocked | Shopkeeper A dispenses to a beneficiary assigned to Shop B | 403 Forbidden; Winston warning logged | | |
| TC-GUARD-04 | Same-shop allowed | Shopkeeper serves their own-shop beneficiary | Allowed (200) | | |
| TC-GUARD-05 | Wallet integrity after blocked claim | Inspect wallet after TC-GUARD-01 or TC-GUARD-03 | Untouched (no deduction on a blocked attempt) | | |

---

## M13 — Pre-Blockchain Validation Dashboard

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-VAL-01 | Integrity checks run | `GET /api/admin/validation/integrity` | 200; all 8 checks return results | | |
| TC-VAL-02 | Card-without-wallet detected | Manually delete a wallet row, re-run | Check #1 flags the orphaned card | | |
| TC-VAL-03 | Suspicious txn (>50 kg) | Insert a 60 kg transaction, re-run | Check #6 flags it | | |
| TC-VAL-04 | Duplicate card numbers | Force two identical `card_number` values, re-run | Check #7 flags it | | |
| TC-VAL-05 | Security checks run | `GET /api/admin/validation/security` | 200; all 6 checks return results | | |
| TC-VAL-06 | Helmet header check | With Helmet active | Security check #1 passes | | |
| TC-VAL-07 | Duplicate mobiles | Two beneficiaries with the same mobile | Security check #5 flags it (no DB-level UNIQUE on `users.mobile`) | | |
| TC-VAL-08 | Readiness score (all clean) | Healthy DB, 8+6 checks pass, 10 checklist ticked | "🚀 Ready for blockchain integration" with 3 green dots | | |
| TC-VAL-09 | Readiness blocked | Introduce one integrity failure | Readiness does **not** show ready | | |

---

## M14 — Security Hardening

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-SEC-01 | Auth rate limit | Send 11 requests to `/auth/login` in 15 min | 11th returns 429 Too Many Requests | | |
| TC-SEC-02 | API rate limit | Send 101 `/api` requests in 1 min | 101st returns 429 | | |
| TC-SEC-03 | Helmet headers | Inspect any response headers | Security headers present (e.g. `X-Content-Type-Options`, etc.) | | |
| TC-SEC-04 | Joi rejects bad input | Send malformed body to any validated route | 400 before controller logic runs | | |
| TC-SEC-05 | SQL injection attempt | `"email":"' OR 1=1 --"` on login | No injection; parameterised query; 401/400, not data leak | | |
| TC-SEC-06 | No password hash leak | Inspect any user API response | `password_hash` never returned to client | | |
| TC-SEC-07 | Winston logging | Trigger a failed login + a cross-shop attempt | Both appear in logs (auth event + cross-shop warning) | | |

---

## M15 — Scheduled Jobs (node-cron)

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-CRON-01 | Entitlement schedule registered | Inspect cron config | Job scheduled `0 6 1 * *` (1st of month, 6 AM) | | |
| TC-CRON-02 | Manual trigger == cron logic | Temporarily set cron to run in 1 min (test env) | Wallets reset identically to the manual allocate button | | |
| TC-CRON-03 | OTP cleanup schedule | Inspect cron config | Job scheduled `0 * * * *` (hourly) | | |
| TC-CRON-04 | OTP cleanup effect | Insert a stale `otp_verifications` row, run cleanup | Stale rows removed | | |
| TC-CRON-05 | Cron idempotency | Allow allocate cron to fire twice same day | Second run skipped (ties to TC-ENT-05) | | |

---

## M16 — Blockchain Readiness (schema-level)

> These verify the schema is ready for the *next* phase. The Solidity contract / Ethers.js
> integration is not built yet, so these are DB-level structural checks only — no on-chain calls.
>
> **Current state of `blockchain_logs` in `schema.sql`:** the table is defined *after* the
> `COMMIT` on line 263, so it runs outside the transaction and would **not** roll back on failure
> (TC-CHAIN-08 exposes this). Additionally, the current definition is missing:
> - UNIQUE on `transaction_id` (TC-CHAIN-02)
> - CHECK on `status` (TC-CHAIN-03)
> - `attempts` and `last_error` columns (TC-CHAIN-01)
> - index on `status` (TC-CHAIN-06)
>
> Apply the hardened definition — with those constraints added and the CREATE TABLE moved to
> **inside** the `BEGIN…COMMIT` block — before running TC-CHAIN-01 through TC-CHAIN-08.

| ID | Test Scenario | Steps / Test Data | Expected Result | Actual | Status |
|---|---|---|---|---|---|
| TC-CHAIN-01 | blockchain_logs table exists | `\d blockchain_logs` | Table present with FK to `transactions(id)`, plus `attempts INTEGER` and `last_error TEXT` columns (after hardened definition applied) | | |
| TC-CHAIN-02 | One log per transaction | Insert two logs with the same `transaction_id` | Second rejected (UNIQUE on `transaction_id`) — **requires hardened definition** | | |
| TC-CHAIN-03 | Status constraint | Insert a row with `status='garbage'` | Rejected by CHECK (`pending`, `confirmed`, `failed` only) — **requires hardened definition** | | |
| TC-CHAIN-04 | FK integrity | Insert a log with a non-existent `transaction_id` | Rejected by FK | | |
| TC-CHAIN-05 | Default status | Insert with `status` omitted | Defaults to `'pending'` | | |
| TC-CHAIN-06 | Pending-poll index | `EXPLAIN` a `WHERE status='pending'` query | Uses `idx_blockchain_logs_status` — **requires hardened definition** | | |
| TC-CHAIN-07 | transactions hash column | Inspect `transactions` | `blockchain_tx_hash TEXT` column exists and is NULL before submission | | |
| TC-CHAIN-08 | Table inside transaction block | Re-run full schema with the hardened definition, force a mid-script error | `blockchain_logs` rolls back with everything else (not left orphaned); **current `schema.sql` fails this** — table is after COMMIT | | |

---

## 4. Traceability summary

| Requirement / Business rule | Covered by |
|---|---|
| Seed coverage (3 policies + 1 admin + 3 areas + 9 shops) | TC-ENV-05 |
| Schema integrity (family_members fix, schema.sql path) | TC-SCHEMA-01..04 |
| AAY rice = 7 kg/person (per-person rule confirmed) | TC-SCHEMA-05, TC-CARD-05/05b, TC-ENT-03 |
| Fixture build (shopkeepers + cards via panel) | TC-FIX-03..07 |
| Role separation (Admin / Shopkeeper / Beneficiary) | TC-AUTH-08, TC-RBAC-01..06 |
| Atomic card creation + rollback | TC-CARD-01..11 |
| Entitlement idempotency | TC-ENT-05, TC-CRON-05 |
| Double-claim prevention | TC-GUARD-01, TC-GUARD-02, TC-GUARD-05 |
| Cross-shop prevention | TC-GUARD-03, TC-GUARD-04 |
| Wallet never negative | TC-WAL-02, TC-DISP-06 |
| Pre-blockchain readiness gate | TC-VAL-01..09 |
| Security layers (rate limit, Helmet, Joi, bcrypt) | TC-SEC-01..07 |
| OTP via Twilio | TC-OTP-01..08 |
| Blockchain schema readiness | TC-CHAIN-01..08 |

---

## 5. Test run sign-off

| Field | Value |
|---|---|
| Tested by | |
| Date of run | |
| Build / commit | |
| Total cases | 113 |
| Passed / Failed / Blocked | |
| Remarks | |

---

## 6. Notes & next steps

**Four things to resolve before a full run:**

1. **Admin password.** Use `admin123` if you followed the standard setup (`npm run seed:admin`).
   Use `abcd1234` only if you imported `schema.sql` directly. Pick one path and be consistent.

2. **family_members fix.** The UNIQUE bug on `ration_card_id` exists in `schema.sql` but **not**
   in migration `001_initial_schema.js`. If you set up via `npm run migrate:up`, the fix in
   TC-SCHEMA-02 may not be needed — verify with `\d family_members` first.

3. **blockchain_logs hardening (M16).** The current `schema.sql` has `blockchain_logs` outside
   the transaction, missing the UNIQUE on `transaction_id`, missing the status CHECK, missing
   `attempts`/`last_error` columns, and missing the status index. TC-CHAIN-02/03/06/08 all fail
   on the unpatched schema. Fix the definition before running M16.

4. **AAY rule is resolved.** The `policies` seed data (`rice_per_person_kg = 7.00`) confirms
   per-person pricing. TC-CARD-05b (6-member AAY → 42 kg rice) is the verification case.

**Recommended next step.** Once your `.env` and local `pds` DB are restored, the backend-layer
cases (auth, RBAC, card creation, entitlement, dispense, guards) can be converted into runnable
Jest + Supertest tests that execute automatically instead of by hand. That gives you a real
regression suite rather than a checklist.
