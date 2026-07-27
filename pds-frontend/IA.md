# Admin information architecture

This is the routing/navigation contract for `pds-frontend`'s admin app —
subsequent prompts build against these exact section groupings, route
paths, and page patterns. Don't change a route path or nav label without
updating this file in the same change.

Single source of truth for the left-rail structure and breadcrumb/section
lookup: `src/config/adminNav.js` (`ADMIN_NAV_SECTIONS`, `ADMIN_ROUTE_LABELS`).
Routing itself lives entirely in `src/App.jsx`.

## Sections

| Section | Nav label | Route | Pattern | Notes |
|---|---|---|---|---|
| OVERVIEW | Dashboard | `/admin` | A | `/admin/dashboard` redirects here |
| OPERATIONS | Areas *(kept, not in original spec)* | `/admin/areas` | B (hybrid, keeps its own stat tiles) | |
| OPERATIONS | Shops | `/admin/shops` | B | `/admin/shops/:shopId/live` is a detail route reached from a row link, no nav entry |
| OPERATIONS | Ration Cards *(kept, not in original spec)* | `/admin/ration-cards` | B | `/admin/ration-cards/new` is its create-form route, no nav entry |
| OPERATIONS | Beneficiaries | `/admin/beneficiaries` | B | |
| OPERATIONS | Entitlements *(kept, not in original spec)* | `/admin/entitlements` | — | Batch preview/allocate workflow, not a list |
| OPERATIONS | Wallets | `/admin/wallets` | B | No backing endpoint yet — empty-shell page |
| OPERATIONS | Dispenses | `/admin/dispenses` | B | Renamed from `IotSessions`/`/admin/iot/sessions`. `/admin/dispenses/:id` is its detail route (renamed from `IotSessionDetail`), no nav entry |

OPERATIONS order intentionally mirrors the real provisioning hierarchy
(plan.md Phase 1): Area exists before a Shop can be created in it, Shop
before a Ration Card can pick it, Ration Card before its Beneficiaries
exist, Entitlements before a Wallet is funded, funded Wallet before a
Dispense can draw against it.
| HEALTH | Blockchain | `/admin/health/blockchain` | D | New route; thin wrapper around `BlockchainHealthCard` for now |
| HEALTH | IoT Fleet | `/admin/health/iot` | D | Renamed from `/admin/iot/fleet` |
| HEALTH | Anchor Queue | `/admin/health/anchors` | D | New route; only an aggregate exists (`AnchorStatusPill`), no per-item list endpoint — empty-shell table |
| INCIDENTS | Anomalies | `/admin/anomalies` | B | |
| INCIDENTS | Audit Log | `/admin/audit` | B | No backing endpoint anywhere in this app yet — empty-shell page |
| SETTINGS | Users & Roles | `/admin/settings/users` | B | Renamed from `/admin/users` |
| SETTINGS | Commodity Tolerances | `/admin/settings/tolerances` | B | No standalone endpoint yet — empty-shell page |
| SETTINGS | Devices | `/admin/settings/devices` | B | Registry doesn't exist yet (distinct from Health/IoT Fleet's live status monitor) — empty-shell page |

Shopkeeper routes (`/shopkeeper/dashboard`, `/shopkeeper/scan`) are untouched
— this IA is admin-only.

### Legacy redirects (nothing 404s)

`/admin/dashboard` → `/admin`, `/admin/users` → `/admin/settings/users`,
`/admin/iot/fleet` → `/admin/health/iot`, `/admin/iot/sessions` →
`/admin/dispenses`, `/admin/iot/sessions/:id` → `/admin/dispenses/:id`.

## Page patterns

- **A — Overview**: grid of Cards (4 wide desktop → 2 → 1), full-width table/list panels below.
- **B — List**: `PanelHeader` (title + search/filter/primary-action in the right slot) → results-meta line → `Table` (or `ResponsiveTable` below 640px) → `EmptyState` when empty → pagination.
- **C — Detail**: `Breadcrumb` + `PanelHeader` (entity ID as title, mono if it's a hash/ID) → `KeyValue` summary in a `Card` → `Tabs` for sub-sections.
- **D — Health**: page-level status pill → 4-tile metric strip → table/chart body → "Updated Xs ago" footer.

Only Dashboard, the three Health pages, Anomalies, and Audit Log have their
*content* actually built to these patterns' full detail — that's later
work. This prompt only established the *routes, shell, and header
mechanism* (`PanelHeader` + route-derived `Breadcrumb` + `document.title`)
for every page; existing pages' body content is otherwise unchanged.

## Navigation behavior

- Active nav item: `border-ds-accent` 2px left border, `bg-ds-surface-alt`, `font-medium text-ds-text-primary`. Inactive: `text-ds-text-secondary`, transparent left border (kept in the DOM so width never shifts).
- Section headers: `text-ds-xs` uppercase `text-ds-text-tertiary`.
- Breadcrumb is generated centrally in `AdminLayout` (`src/App.jsx`) from `getBreadcrumbItems(pathname)` — pages never render their own `Breadcrumb`.
- Scroll position resets to top only when the IA *section* changes (via `getSectionForPath`); navigating within the same section preserves scroll.
- Below 1024px: the rail becomes an off-canvas drawer (hamburger button in the top bar), main content padding drops to 16px.
- Below 640px: list pages using `ResponsiveTable` (`src/design/patterns/ResponsiveTable.jsx`) render each row as a `Card` of `KeyValue` pairs instead of a table.

## Command palette & shortcuts

- `Ctrl/Cmd+K` opens `src/components/admin/CommandPalette.jsx`. Searches nav routes (static) plus shops, ration cards (beneficiaries), and IoT devices — each fetched once via its existing list endpoint (no server-side search param exists on any of them) and filtered client-side, debounced 150ms. Grouped results, arrow-key navigation, Enter to go, Escape to close.
- `g d` → Dashboard, `g s` → Shops, `g h b` → Blockchain, `g h i` → IoT Fleet, `g a` → Anomalies, implemented in `src/hooks/useGlobalShortcuts.js`. Ignored while focus is in a form control; `Ctrl/Cmd+K` still works from inside one.
- Both are mounted once, in `AdminLayout`.

## Known gaps (intentionally empty-shell, not fabricated)

Wallets, Audit Log, Commodity Tolerances, and Devices have no backing API
anywhere in this codebase today (verified, not assumed) — each renders a
real `EmptyState` explaining why, rather than fake data. The Blockchain and
Anchor Queue pages similarly only show what their existing endpoints
actually return; Anchor Queue's per-item table is an `EmptyState` since only
an aggregate pending-count exists.

## What changed vs. the pre-existing chrome

`AdminLayout` (in `src/App.jsx`) now renders `AppShell` instead of the old
dark `Sidebar/AdminTopBar`. `AnomalyBadge` and `ThemeToggle` moved into
`AppShell`'s `topBarActions` slot; the old account dropdown became a single
logout action on the avatar button (`AppShell`'s `onLogout` prop). The old
`Sidebar.jsx`, `AdminTopBar.jsx`, and `AdminHeaderContext.jsx` are left in
place but are no longer imported from anywhere in the admin route tree —
candidates for deletion in a future cleanup pass, not removed here.
