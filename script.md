# Admin Panel Walkthrough Script

**Purpose:** A plain-language script for demoing the PDS Admin Portal to a non-technical audience (stakeholders, program officers, new admins). Read it top to bottom in a live demo, or hand it out as a self-guided tour — it follows the exact order of the left-hand menu.

**How to use it:** Each section below = one item in the sidebar. For each page you get: a one-line "what it's for," the talking points to click through, and (where relevant) an honest note on what's fully working today vs. what's still a placeholder.

---

## Before you start: the big picture

> "This is the control room for the whole ration-distribution system. Everything a beneficiary or shopkeeper does downstream — generating a QR code, scanning it, getting rice weighed out — traces back to something an admin set up here first. The sidebar is organized in five groups, top to bottom: **Overview** (the dashboard), **Operations** (day-to-day data entry), **Health** (is the system working right now), **Incidents** (did anything go wrong), and **Settings** (who's allowed to do what)."

---

## 1. OVERVIEW

### Dashboard (`/admin`)
**What it's for:** The landing page — a single glance at whether the system is healthy today, and who it's serving.

**Talking points:**
- Shows blockchain connectivity status right up top (see [Health → Blockchain](#blockchain-adminhealthblockchain) below for the detailed version).
- Two donut charts give an instant read on the beneficiary base: **Beneficiaries by Category** (APL/BPL/AAY split) and **Beneficiaries by Area** (per-region split, folding anything past the top 3 areas into "Other").
- Each is a live filter, not just a picture — click a slice (or its legend row) and it jumps straight to the Beneficiaries list pre-filtered to that category or area, so "analyse" and "drill in" are the same click.

---

## 2. OPERATIONS
*This is where admins do the actual provisioning work — the paper-trail equivalent of filling out ration-shop registers, but digital.*

### Areas (`/admin/areas`)
**What it's for:** Define the regions/zones the program operates in — the first building block everything else hangs off of.

**Talking points:**
- Top row of stat cards: total areas, how many are active, total shops and beneficiaries across all of them — instant sense of scale.
- Search box to find an area by name.
- **Add Area** — just a name and an active/inactive toggle.
- Marking an area inactive doesn't delete it — it just hides it from the "pick an area" dropdown when creating a new shop, so existing shops in it keep working.

### Shops (`/admin/shops`)
**What it's for:** Register ration shops and assign a shopkeeper to run each one.

**Talking points:**
- One row per shop: code, name, area, assigned shopkeeper, mobile number, how many beneficiaries it serves, active/inactive.
- Click a row to expand it in place for a quick detail view — no page navigation needed.
- **Add Shop** — pick an area, give it a code and a name.
- **Bulk Upload** — for onboarding many shops at once from a spreadsheet instead of one by one.
- **Assign** — link a shopkeeper account to a shop (only shows shopkeepers not already assigned elsewhere).
- **Live weight** link — jumps to that shop's real-time scale reading (see [IoT Fleet](#iot-fleet-adminhealthiot)).
- Shops can be deleted here too, with a confirmation prompt.

### Beneficiaries (`/admin/beneficiaries`)
**What it's for:** Browse every registered ration-card family — a read-only directory, not a data-entry screen.

**Talking points:**
- Filter by category (APL / BPL / AAY — the government income-tier classifications), by area, or by shop.
- Table shows name, mobile, card number, category, shop, area, and family size.
- Think of this as the "who is this system serving" view — the actual card creation happens over in Ration Cards.

### Dispenses (`/admin/dispenses`)
**What it's for:** Live feed of every dispense transaction — especially useful for shops with an IoT scale, where you can watch a dispense move through its states in real time.

**Talking points:**
- Filter by state: active, weighing, confirming, committed, cancelled, device lost, expired, etc.
- Each row shows entitled grams vs. what was actually measured, and whether it's been anchored to the blockchain yet.
- Click any row to drill into a single dispense's full detail and timeline.

### Wallets (`/admin/wallets`)
**What it's for:** *(Placeholder today.)* Intended as a dedicated ledger of every family's rice/wheat balances.

**Talking points:**
- Be upfront about this one: balances are visible today on each ration card / beneficiary record, but there's no standalone wallet-ledger screen yet. The page says so plainly rather than faking data.

### Ration Cards (`/admin/ration-cards`)
**What it's for:** The core provisioning screen — this is where a family actually gets enrolled in the program.

**Talking points:**
- Table view: card number, category, head-of-family name, shop, area, family size, and current rice/wheat balances.
- **Add Ration Card** opens a dedicated form: pick the shop, fill in the head of household and family members — this single action also auto-creates their user accounts and funds their first month's wallet.
- **Bulk Upload** for onboarding many families at once.

### Entitlements (`/admin/entitlements`)
**What it's for:** Run the monthly ration allocation — the digital equivalent of "restocking everyone's quota on the 1st of the month."

**Talking points:**
- **Preview Allocation** first — shows exactly what every active card would receive (rice/wheat in kg, per category rules) before anything changes. Allocation is per ration card, not per person: each category carries its own per-card figure (APL 1 kg rice / 0.7 kg wheat, BPL 3 / 2, AAY 4 / 3), sized so a card's whole allocation for one commodity completes in a single IoT dispensing transaction.
- **Allocate Monthly Ration** actually applies it, after a confirmation dialog warning that it resets balances and can't be undone.
- Normally this happens automatically every month, so this page is mainly for visibility and manual re-runs if needed.

---

## 3. HEALTH
*Is the system working right now? This group is monitoring, not data entry — nothing here is edited by hand except the two device actions noted below.*

### Blockchain (`/admin/health/blockchain`) {#blockchain-adminhealthblockchain}
**What it's for:** Is the tamper-proof ledger connection alive, and is there enough "gas" money in the wallet to keep writing to it?

**Talking points:**
- Status pill: Healthy / Degraded / Down, auto-refreshing every 10 seconds.
- Metric tiles: latest block number, gas balance (with a low-balance warning), contract address.
- Anchor throughput card: how many dispenses were confirmed vs. still pending in the last hour, and the failure rate.
- Honest gap to mention: there's no per-transaction anchor history table yet — only these aggregate numbers.

### IoT Fleet (`/admin/health/iot`) {#iot-fleet-adminhealthiot}
**What it's for:** Status of every registered weighing scale out in the field.

**Talking points:**
- Per-device row: which shop it's in, online/stale/offline, last-seen time, how long since it was calibrated, sessions in the last 24 hours.
- Flags devices that need recalibration.
- **Recalibrate** button — queues the device into calibration mode next time it connects, without interrupting an active weighing session.

### Anchor Queue (`/admin/health/anchors`)
**What it's for:** How many dispenses are waiting to be written to the blockchain right now.

**Talking points:**
- Currently shows just the aggregate pending count (shared with the Blockchain page) — a per-item queue list is a planned addition, not yet built. Say so plainly rather than implying more detail exists.

---

## 4. INCIDENTS
*Oversight and compliance — did anything unusual happen, and is there a paper trail of admin actions.*

### Anomalies (`/admin/anomalies`)
**What it's for:** Automatically-flagged suspicious activity — the system's own fraud/error detector.

**Talking points:**
- Filter by severity (info / warn / critical) and by resolved/unresolved.
- Each flag shows which rule triggered it, which shop, a plain-English description, and when it was raised.
- **Resolve** marks a flag as handled — explicitly does *not* touch any underlying data (no wallet or transaction is changed), and doesn't stop the same rule from firing again later.

### Audit Log (`/admin/audit`)
**What it's for:** *(Placeholder today.)* A complete history of admin actions for compliance review.

**Talking points:**
- Be candid here too: the backend is already recording actions (recalibrations, resolving anomalies, cancelling sessions) internally, but there's no endpoint yet to read that history back into the UI. The screen — filters, table, detail drawer — is fully built and ready; it just has nothing to display until that endpoint exists.

---

## 5. SETTINGS
*Configuration that changes rarely — who has access, and how the hardware is registered.*

### Users & Roles (`/admin/settings/users`)
**What it's for:** Manage admin and shopkeeper accounts and permissions.

**Talking points:**
- Search by name/email/mobile, filter by role or active status.
- **Add Shopkeeper** creates a new shopkeeper account (separate from creating a shop — you assign them together over in Shops).
- **Bulk Upload** for onboarding many shopkeeper accounts at once.
- Edit a user's name, email, mobile, and active status inline; delete any non-admin user with a confirmation prompt.

### Commodity Tolerances (`/admin/settings/tolerances`)
**What it's for:** *(Placeholder today.)* Intended to let admins configure the acceptable weighing variance per commodity.

**Talking points:**
- Today the tolerance is a fixed value baked into each dispense session, not something adjustable here yet — the page says so rather than pretending a setting exists.

### Devices (`/admin/settings/devices`)
**What it's for:** *(Placeholder today.)* Registry of IoT scales, separate from their live status.

**Talking points:**
- For live "is it online right now" status, point people to Health → IoT Fleet instead — this page is the (currently empty) registration list.

---

## Quick reference: what's fully live vs. what's a placeholder

| Section | Status |
|---|---|
| Dashboard, Areas, Shops, Beneficiaries, Dispenses, Ration Cards, Entitlements | ✅ Fully functional |
| Blockchain, IoT Fleet | ✅ Fully functional (monitoring, auto-refreshing) |
| Anomalies, Users & Roles | ✅ Fully functional |
| Wallets, Anchor Queue, Audit Log, Commodity Tolerances, Devices | 🚧 Placeholder — screen is built, but the underlying data/endpoint doesn't exist yet |

**Closing line for the demo:** "Everything marked ✅ is real, live data you can act on today. Everything marked 🚧 has a finished, ready-to-go screen waiting for one more piece of backend work — nothing here is faked or hidden, just sequenced."
