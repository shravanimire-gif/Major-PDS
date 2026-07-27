# PDS Architecture: Admin Ration Card Creation → Successful Dispense

Source of truth for this document: current code in `pds-backend`, `pds-frontend`, `pds-beneficiary`, `blockchain`, `iot-device`, and `schema.sql`. Built for turning into flow/sequence diagrams — every step below names the actual endpoint, file, and DB table involved.

---

## 0. System Components (reference for a component/architecture diagram)

```mermaid
flowchart TB
    subgraph Actors
        Admin["Admin (browser)"]
        Shopkeeper["Shopkeeper (browser)"]
        Beneficiary["Beneficiary (Expo mobile app)"]
        Scale["ESP32 + HX711 load cell"]
    end

    subgraph Apps
        FE["pds-frontend (React/Vite, static)\nAdmin + Shopkeeper UI"]
        BEN["pds-beneficiary (React Native/Expo)"]
    end

    subgraph Backend["pds-backend (Express, Render web service)"]
        REST["REST API\n/api/admin /api/shopkeeper\n/api/beneficiary /api/dispense /auth"]
        WSAdmin["WS /ws/admin/live"]
        WSShop["WS /ws/shopkeeper/live"]
        WSIot["WS /ws/iot"]
        Jobs["Cron jobs:\nentitlementCron (monthly reset)\notpCleanup (hourly)\nanchorRetryCron (5 min)\nanomaly*Cron"]
    end

    DB[("Postgres (Render managed)\nusers, ration_cards, family_members,\nwallets, transactions, qr_sessions,\ndispense_sessions, dispense_records,\niot_devices, sensor_readings")]

    subgraph Chain["Ethereum Sepolia (testnet)"]
        Ledger["PDSLedger.sol\nrecordTransaction()\nimmutable dispense audit log"]
    end

    Admin --> FE
    Shopkeeper --> FE
    Beneficiary --> BEN
    Scale <-- "wss /ws/iot\n(Sec-WebSocket-Protocol token)" --> WSIot

    FE <-- "HTTPS REST + JWT" --> REST
    FE <-- "wss /ws/shopkeeper/live" --> WSShop
    BEN <-- "HTTPS REST + JWT" --> REST

    REST <--> DB
    Jobs <--> DB
    WSAdmin <--> DB
    WSShop <--> DB
    WSIot <--> DB

    REST -- "ethers.js JSON-RPC\n(fire-and-forget / anchor queue)" --> Ledger
    Jobs -- "anchorRetryCron retries failed anchors" --> Ledger
```

**Deployment topology** (`render.yaml`): `pds-backend` (Node web service) + `pds-frontend` (static site) + managed Postgres all on Render. `pds-beneficiary` is not deployed anywhere — it runs via Expo Go on a phone pointed at the backend host. The `blockchain` contract is deployed once to Sepolia (`PDSLedger` at `0xD3A989A423FDB3cF28024D1c67aaC04e4743e5B4`) and is called over RPC from the backend, not co-hosted. The `iot-device` is physical ESP32 firmware on-site at a shop, not a hosted service.

---

## Phase 1 — Admin Setup & Ration Card Provisioning

**Goal:** get a beneficiary family onto the system with an active ration card and a funded wallet.

**Prerequisite order** (each step depends on the last): Area → Shop (in that area) → Shopkeeper (user) → assign Shopkeeper to Shop → Ration Card (picks a shop, which implies the area) → wallet auto-created from policy.

```mermaid
sequenceDiagram
    actor Admin
    participant FE as pds-frontend (AddRationCard.jsx)
    participant API as pds-backend (adminController.js)
    participant DB as Postgres

    Admin->>FE: POST /admin/areas {name}
    FE->>API: createArea
    API->>DB: INSERT INTO areas

    Admin->>FE: POST /admin/shops {shop_code, area_id}
    FE->>API: createShop
    API->>DB: INSERT INTO shops

    Admin->>FE: POST /admin/shopkeepers {name, email, password}
    FE->>API: createShopkeeper
    API->>DB: INSERT INTO users (role='shopkeeper')

    Admin->>FE: PATCH /admin/shops/:id/assign-shopkeeper
    FE->>API: assignShopkeeper
    API->>DB: UPDATE shops SET shopkeeper_id

    Admin->>FE: Fill card form: card_number, category (APL/BPL/AAY),\nshop_id, head{name,age,mobile}, members[]
    FE->>API: POST /admin/ration-cards
    activate API
    API->>DB: BEGIN
    API->>DB: SELECT card_number dup check
    API->>DB: SELECT shop_id valid?
    API->>DB: SELECT head mobile not already beneficiary
    API->>DB: SELECT policies WHERE category (rice/wheat/sugar per-person kg)
    API->>DB: INSERT users (head, role='beneficiary')
    API->>DB: INSERT ration_cards (card_number, category, head_user_id, shop_id, area_id)
    API->>DB: INSERT family_members (head, is_head=true)
    loop each member in members[]
        API->>DB: INSERT users (role='beneficiary')
        API->>DB: INSERT family_members (is_head=false)
    end
    API->>DB: wallet = policy.*_per_person_kg * family_size
    API->>DB: INSERT wallets (rice/wheat/sugar_balance_kg)
    API->>DB: COMMIT
    deactivate API
    API-->>FE: 201 {ration_card, members_created, wallet}
    FE-->>Admin: success toast, balances shown
```

| Step | Endpoint | Key file | Tables written | Tables read |
|---|---|---|---|---|
| Create area | `POST /api/admin/areas` | `adminController.js:486` | `areas` | — |
| Create shop | `POST /api/admin/shops` | `adminController.js:644` | `shops` | `areas` |
| Create shopkeeper | `POST /api/admin/shopkeepers` | `adminController.js:743` | `users` | — |
| Assign shopkeeper→shop | `PATCH /api/admin/shops/:id/assign-shopkeeper` | `adminController.js:579` | `shops` | `users`, `shops` |
| **Create ration card** | `POST /api/admin/ration-cards` | `adminController.js:16-156` `createRationCard` | `users`, `ration_cards`, `family_members`, `wallets` | `ration_cards`, `shops`, `users`, `policies` |
| Bulk variants | `/ration-cards/bulk`, `/shops/bulk`, `/shopkeepers/bulk`, `/family-members/bulk` | `adminController.js:823-1221` | same tables, row-by-row | same |
| Integrity check | `GET /api/admin/validation/integrity` | `adminController.js:1223` | — | `ration_cards`, `wallets`, `family_members`, `transactions` |

**UI path:** `pds-frontend/src/pages/admin/RationCards.jsx` → "Add Ration Card" → `AddRationCard.jsx` (area select → shop select → head/member form) → submit → back to list.

**Recurring maintenance in this phase's domain:** `entitlementCron.js` runs monthly (1st, 6AM Asia/Kolkata) and resets every wallet to `policy.*_per_person_kg × family_size` (idempotent via `last_reset_date`). This is what "refills" a card's wallet each month after Phase 1 has provisioned it once.

---

## Phase 2 — Beneficiary QR Generation & Shopkeeper Validation

**Goal:** beneficiary proves who they are and which shop they're entitled to, without the shopkeeper having standing access to card data — a short-lived, single-use QR session is the hand-off token.

```mermaid
sequenceDiagram
    actor Ben as Beneficiary
    participant App as pds-beneficiary (Expo)
    actor Shop as Shopkeeper
    participant FE as pds-frontend (ScanAndDispense.jsx)
    participant API as pds-backend
    participant DB as Postgres

    Ben->>App: mobile number
    App->>API: POST /auth/otp/send {mobile}
    Ben->>App: enter OTP
    App->>API: POST /auth/otp/verify {mobile, otp}
    API-->>App: JWT stored in AsyncStorage

    App->>API: GET /api/beneficiary/wallet, /me, /family, /transactions
    Ben->>App: taps "Generate QR Code"
    App->>API: POST /api/beneficiary/qr-session (JWT auth)
    activate API
    API->>DB: SELECT ration_card, shop_id\nFROM ration_cards JOIN family_members\nWHERE user_id=me AND is_head=true
    API->>API: sessionId = crypto.randomBytes(32)\nexpiresAt = now + 60s
    API->>DB: INSERT INTO qr_sessions\n(session_id, ration_card_id, shop_id,\nissued_to_user_id, expires_at)
    deactivate API
    API-->>App: {rationCardId, sessionId, expiresAt}
    App-->>Ben: renders QR = JSON of the 3 fields\n(auto-refreshes every 60s until scanned)

    Shop->>FE: opens camera (QRScanner.jsx / zxing)
    Ben->>Shop: shows phone screen
    FE->>FE: decode QR text, parse JSON,\nclient-side expiry pre-check
    FE->>API: GET /api/shopkeeper/beneficiary/:rationCardId?sessionId=...
    activate API
    API->>DB: SELECT shop WHERE shopkeeper_id=me (assigned shop)
    API->>DB: SELECT qr_sessions WHERE session_id
    API->>API: validate: card matches, shop matches,\nissuer matches, not used, not expired
    API->>DB: SELECT ration_card+shop+area+family+users+wallet
    deactivate API
    API-->>FE: beneficiary profile + wallet balances
    FE-->>Shop: shows beneficiary + wallet on screen
```

**Notes for the diagram:**
- The scanner-side validation (`GET /api/shopkeeper/beneficiary/:rationCardId`) is **read-only / advisory** — it does not mark `qr_sessions.is_used`. The authoritative check happens again inside the dispense transaction in Phase 3.
- QR payload is exactly `{ rationCardId, sessionId, expiresAt }`, generated in `pds-beneficiary/src/screens/QRScreen.js` and parsed in `pds-frontend/src/pages/shopkeeper/ScanAndDispense.jsx`.
- One `qr_sessions` row is scoped to one ration card + one shop + a 60-second window — this is the core anti-fraud control (a QR can't be reused, replayed elsewhere, or used after it expires).

| Step | Endpoint | Key file | Tables touched |
|---|---|---|---|
| OTP login | `POST /auth/otp/send`, `/auth/otp/verify` | `routes/auth.js`, `otp_verifications` table | `otp_verifications`, `users` |
| Wallet/profile fetch | `GET /api/beneficiary/{me,wallet,family,transactions}` | `beneficiaryController.js` | read-only |
| Generate QR | `POST /api/beneficiary/qr-session` | `beneficiaryController.js:142-183 createQrSession` | insert `qr_sessions` |
| Scan + validate | `GET /api/shopkeeper/beneficiary/:rationCardId` | `shopkeeperController.js:84-205` | read `qr_sessions`, `ration_cards`, `wallets`, etc. |

---

## Phase 3 — Dispense Execution & Settlement

**Goal:** atomically deduct the wallet, log an immutable transaction, burn the QR session, and anchor the record on-chain — with an optional IoT weighing sub-flow layered on top of the same session.

```mermaid
flowchart TD
    Start(["Shopkeeper: beneficiary loaded, quantities entered"]) --> Branch{"IoT scale\nattached to shop?"}

    Branch -- "No (manual, default path)" --> Confirm["Confirm Dispense button\nPOST /api/shopkeeper/dispense\n{ration_card_id, session_id, rice/wheat/sugar_qty_kg}"]

    Branch -- "Yes (optional)" --> Weigh["POST /api/dispense/session\n+ /session/:id/attach\nWS /ws/shopkeeper/live subscribes"]
    Weigh --> ESP32["ESP32 streams gram readings\nvia wss /ws/iot"]
    ESP32 --> StateMachine["dispenseSessionService state machine:\nweighing -> confirming -> committed"]
    StateMachine --> Commit["commitSession()"]

    Confirm --> Tx["shopkeeperController.dispense (DB transaction)"]

    subgraph TxSteps["Inside the transaction"]
        direction TB
        T1["1. Double-claim guard:\nCOUNT(transactions) this ration_card this month == 0"]
        T2["2. SELECT qr_sessions ... FOR UPDATE\n(row lock, re-validate card/shop/user/used/expiry)"]
        T3["3. SELECT wallets ... FOR UPDATE\n(row lock)"]
        T4["4. Balance check: qty <= wallet balance"]
        T5["5. UPDATE wallets SET balances -= qty"]
        T6["6. INSERT INTO transactions\n(ration_card_id, shop_id, qtys, served_by)"]
        T7["7. UPDATE qr_sessions SET is_used=true"]
        T1-->T2-->T3-->T4-->T5-->T6-->T7
    end

    Tx --> TxSteps
    TxSteps --> CommitDB["COMMIT"]
    Commit --> CommitDB

    CommitDB --> Anchor["Fire-and-forget / anchor-queue call:\nblockchainService.recordDispense()\nethers.js -> Sepolia PDSLedger.recordTransaction()"]
    Anchor -- "success" --> Patch["UPDATE transactions/dispense_records\nSET blockchain_tx_hash"]
    Anchor -- "failure (logged, never blocks)" --> Retry["anchorRetryCron (every 5 min)\nretries until anchored"]

    CommitDB --> Success(["200 response:\ntransaction, dispensed{}, remaining_wallet{}\nUI shows SUCCESS screen"])
```

**Manual path (default, no IoT hardware needed) — the "happy path" for the diagram:**
1. Shopkeeper taps **Confirm Dispense** → `POST /api/shopkeeper/dispense` (`shopkeeperController.js:207-469`).
2. Pre-check: reject if this ration card already has a transaction this calendar month ("one dispense per card per month").
3. `BEGIN` transaction; row-lock `qr_sessions` (`FOR UPDATE`) and re-validate session↔card↔shop↔user↔used↔expiry — this is the **authoritative** check (Phase 2's check was advisory only).
4. Row-lock `wallets` (`FOR UPDATE`); verify requested kg ≤ balance for each commodity.
5. `UPDATE wallets` (deduct), `INSERT INTO transactions` (`served_by` = shopkeeper), `UPDATE qr_sessions SET is_used=true` — QR can never be replayed.
6. `COMMIT`.
7. **Outside** the transaction, fire-and-forget call to `blockchainService.recordDispense()` → `ethers.js` → Sepolia `PDSLedger.recordTransaction(transactionId, cardNumber, shopCode, riceQtyGrams, wheatQtyGrams, timestamp)`. This never throws and never blocks/rolls back the HTTP response — if it fails, `transactions.blockchain_tx_hash` simply stays null and the shopkeeper still sees success.
8. Response includes updated wallet balance and transaction id; UI shows the SUCCESS screen.

**Optional IoT weighing path (parallel/alternate, only if a shop has an ESP32 scale registered and online):**
1. `GET /api/dispense/device-status` on the same scanned session — if a scale is live, shopkeeper sees a "Weigh on Scale" option instead of/alongside manual entry.
2. `POST /api/dispense/session` creates a `dispense_sessions` row bound to the QR session's ration card + entitled grams; `POST /session/:id/attach` binds the physical device.
3. ESP32 streams `{"type":"reading","grams":...}` frames at ~10Hz over `wss:///ws/iot`; backend relays live readings to the shopkeeper's browser over `wss:///ws/shopkeeper/live`.
4. `dispenseSessionService` drives a state machine (`weighing → confirming → committed`/`cancelled`/`device_lost`/`failed_insufficient_balance`); on `committed` it performs the equivalent of steps 4-6 above against `dispense_records`/`wallets`, then calls `enqueueAnchor()` (a queued/retried version of the same `blockchainService.recordDispense()` call, retried every 5 min by `anchorRetryCron` if it fails) instead of pure fire-and-forget.
5. Falls back to the manual path automatically if no device is attached or the device disconnects mid-weigh.

| Step | Endpoint | Key file | Tables touched |
|---|---|---|---|
| Manual dispense | `POST /api/shopkeeper/dispense` | `shopkeeperController.js:207-469` | read+lock `qr_sessions`,`wallets`,`transactions`(dup-check); write `wallets`,`transactions`,`qr_sessions` |
| Alt "blockchain-stable" endpoint | `POST /api/shopkeeper/transactions` | `shopkeeperController.js:473-628` | same as above but **skips qr_sessions validation** — legacy/alt integration path |
| IoT session create/attach | `POST /api/dispense/session`, `/session/:id/attach` | `dispenseSessionController.js` | `dispense_sessions` |
| IoT live weighing | `wss:///ws/iot` (device), `wss:///ws/shopkeeper/live` (browser) | `ws/iotSocketServer.js`, `ws/shopkeeperSocketServer.js` | `sensor_readings`, `dispense_sessions` |
| Commit IoT session | `dispenseSessionService.commitSession()` | `services/dispenseSessionService.js` | `dispense_records`, `wallets` |
| Blockchain anchor (manual) | fire-and-forget | `services/blockchainService.js recordDispense()` | `transactions.blockchain_tx_hash` |
| Blockchain anchor (IoT) | queued + retried | `services/anchorEnqueuer.js`, `jobs/anchorRetryCron.js` | `dispense_records.blockchain_tx_hash` / `last_anchor_error` |

---

## End-to-End Summary (all 3 phases chained)

```mermaid
flowchart LR
    P1["Phase 1\nAdmin: Area -> Shop -> Shopkeeper ->\nassign -> Ration Card -> Wallet funded"]
    P2["Phase 2\nBeneficiary: OTP login -> view wallet ->\ngenerate 60s QR session\nShopkeeper: scan -> validate (read-only)"]
    P3["Phase 3\nShopkeeper: confirm qty (or weigh on scale) ->\nDB tx: lock+validate session, lock wallet,\ndeduct, insert transaction, burn QR ->\nasync blockchain anchor to Sepolia"]

    P1 --> P2 --> P3
    P3 -. "monthly reset" .-> P1
```

## Known Issues Worth Footnoting on the Diagram

1. **`qr_sessions` schema drift**: `schema.sql` defines `session_id VARCHAR(64)`, but `server.js` boot-time `ensureDatabaseGuards()` creates it as `VARCHAR(150)` with slightly different defaults if the table doesn't already exist — whichever ran first on a given DB wins.
2. **`blockchain_logs` table is unused**: defined in `schema.sql` but no application code writes to it; the real anchor status lives on `transactions.blockchain_tx_hash` / `dispense_records.blockchain_tx_hash`.
3. **Sugar-only dispense never anchors**: `PDSLedger.recordTransaction` requires rice or wheat grams > 0, so a sugar-only dispense silently never gets a blockchain record.
4. **`POST /api/shopkeeper/transactions`** is a parallel dispense endpoint that skips QR-session validation entirely — flagged in code comments as a legacy/"blockchain-stable, do not change" path; worth a dotted-line/alternate-path box rather than merging it into the main dispense arrow.
