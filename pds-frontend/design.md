# PDS Frontend — Enterprise Design System

This document defines the visual language, component standards, and rollout plan for turning
`pds-frontend` from a functional prototype into an enterprise-grade application. It is written
against the current codebase (React 19, React Router 7, Tailwind CSS v4, Vite) so every
recommendation maps to real files, not hypothetical ones.

---

## 1. Where we are today (audit)

Reviewed: [Sidebar.jsx](src/components/admin/Sidebar.jsx), [TopBar.jsx](src/components/shopkeeper/TopBar.jsx),
[Login.jsx](src/pages/Login.jsx), [Dashboard.jsx](src/pages/admin/Dashboard.jsx),
[RationCards.jsx](src/pages/admin/RationCards.jsx), [BlockchainHealthCard.jsx](src/components/admin/BlockchainHealthCard.jsx).

Findings:

- **No design tokens.** Every file hardcodes raw Tailwind colors (`bg-gray-900`, `text-blue-400`,
  `border-gray-800`) instead of semantic names. Changing the brand color today means editing 20+ files.
- **No shared component layer.** Buttons, inputs, cards, badges, and tables are re-implemented
  inline on every page with slightly different paddings/radii each time (`rounded-lg` vs
  `rounded-2xl`, `p-6` vs `p-5`, badge colors defined ad hoc in `getCategoryBadgeClass`).
- **Emoji as icons.** `⚡ Entitlements`, `↑ Bulk Upload`, `+ Add Ration Card` — reads as a prototype,
  not a production system.
- **No typography scale.** Headings jump between `text-lg`, `text-xl`, `text-2xl`, `text-3xl`
  with no consistent rule for when to use which.
- **No branding.** The app identifies itself only as text ("PDS Admin", "PDS Shopkeeper") — no
  logo, no favicon beyond the Vite default, no consistent app chrome.
- **Bare states.** Loading is a plain "Loading..." text node; empty states are ad hoc per page;
  there's no shared skeleton, error, or toast/notification pattern.
- **Tables are raw HTML** with no sorting, filtering, pagination, or column truncation strategy —
  fine at 10 rows, unusable at 10,000.
- **Font is declared but not loaded.** `index.css` sets `font-family: Inter, ...` but no
  `@font-face`/Google Fonts/`@fontsource` import exists, so it silently falls back to system UI.

None of this is a rewrite-scale problem — the component logic (data fetching, routing, auth) is
solid. This is a presentation-layer pass.

---

## 2. Design principles

1. **Density over decoration.** This is a system operators use for hours a day (ration card
   lookups, shop management, dispensing). Optimize for scanability and low visual noise, not
   marketing polish.
2. **One source of truth per visual decision.** Every color, spacing value, radius, and shadow
   comes from a token. No new raw Tailwind color utility (`bg-gray-800`, `text-blue-400`, etc.)
   should appear in a page/component file after migration — only semantic classes/tokens.
3. **Consistent chrome, flexible content.** The admin shell and shopkeeper shell look like the
   same product wearing two hats, not two different apps.
4. **State is never implicit.** Every async view has an explicit loading, empty, error, and
   populated state, rendered with shared components.
5. **Accessible by default.** WCAG AA contrast, visible focus rings, keyboard-operable modals/menus,
   `aria-*` on icon-only buttons. Government-adjacent software should not fail an audit.

---

## 3. Theme

Recommendation: **light-first enterprise theme** with the existing dark sidebar kept as an accent,
rather than the current all-dark UI. Rationale: PDS is an operations/back-office tool (data entry,
tables, forms) used in daylight retail/shop conditions on the shopkeeper side — light UIs read as
"enterprise line-of-business" (Salesforce, SAP, government portals), while full-dark reads as
"developer tool." Dark mode ships as a user-toggleable theme, not the only option, since Tailwind
v4 makes that close to free.

### 3.1 Color tokens

Define these once in `src/index.css` using Tailwind v4's `@theme` block, and reference tokens
(`bg-surface`, `text-primary`, `border-default`, …) everywhere instead of raw palette classes.

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-brand-50:  #eef4ff;
  --color-brand-100: #dce8ff;
  --color-brand-300: #93b4ff;
  --color-brand-500: #2f6feb;   /* primary actions, links, focus */
  --color-brand-600: #1f56c4;   /* hover/active */
  --color-brand-700: #163f92;

  /* Neutrals (UI surfaces & text) */
  --color-surface:        #ffffff;
  --color-surface-muted:  #f6f7f9;
  --color-surface-sunken: #eef0f3;
  --color-border:         #e2e5ea;
  --color-border-strong:  #c9cdd6;
  --color-text-primary:   #12141a;
  --color-text-secondary: #565b66;
  --color-text-disabled:  #9ca0aa;

  /* Dark sidebar/chrome (kept from current design, tokenized) */
  --color-chrome-bg:      #0f1420;
  --color-chrome-hover:   #1b2233;
  --color-chrome-active:  #232c42;
  --color-chrome-text:    #e6e8ee;
  --color-chrome-text-muted: #8890a3;

  /* Semantic status */
  --color-success-bg: #e7f7ee; --color-success-text: #147a4b; --color-success-border: #b7ecce;
  --color-warning-bg: #fff6e5; --color-warning-text: #9a6700; --color-warning-border: #ffe4a3;
  --color-danger-bg:  #fdecec; --color-danger-text:  #b3261e; --color-danger-border: #f6c6c3;
  --color-info-bg:    #eaf2ff; --color-info-text:    #1f56c4; --color-info-border:  #c9dcff;
}

/* Dark mode overrides — activated by a `data-theme="dark"` attribute on <html> */
[data-theme="dark"] {
  --color-surface:        #12141a;
  --color-surface-muted:  #1a1d26;
  --color-surface-sunken: #0d0f14;
  --color-border:         #262a35;
  --color-border-strong:  #363b48;
  --color-text-primary:   #f2f3f5;
  --color-text-secondary: #a6abb8;
  --color-text-disabled:  #5c616e;
}
```

Category/status colors used today (`APL`/`BPL`/other ration card badges, blockchain health
`healthy`/`degraded`/`down`) map onto the semantic tokens above — `info` for APL, `warning` for
BPL, `danger` for the lowest-priority category, `success`/`warning`/`danger` for health states.
No page should invent its own color for a badge.

### 3.2 Elevation & radius

Standardize on 3 radii and 3 shadow levels — stop mixing `rounded-lg`/`rounded-2xl` per component:

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | inputs, badges, buttons |
| `--radius-md` | 10px | cards, modals, table containers |
| `--radius-lg` | 16px | page-level panels, login card |
| `--shadow-sm` | subtle 1px border + `0 1px 2px rgba(0,0,0,.05)` | resting cards |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,.08)` | dropdowns, popovers |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,.16)` | modals |

---

## 4. Typography

Load Inter for real (`@fontsource/inter` via `npm install @fontsource/inter`, imported once in
`main.jsx`) so the existing `font-family: Inter` declaration in [index.css](src/index.css) actually
resolves.

| Role | Class | Size / weight | Example |
|---|---|---|---|
| Page title | `text-2xl font-semibold` | 24px / 600 | "Ration Cards", "Admin Dashboard" |
| Section heading | `text-lg font-semibold` | 18px / 600 | Card titles ("Blockchain Integration") |
| Body | `text-sm` | 14px / 400 | Table cells, form labels, paragraph text |
| Caption / meta | `text-xs text-secondary` | 12px / 400 | Timestamps, helper text, badges |
| Numeric emphasis | `text-lg font-bold tabular-nums` | 18px / 700 | Stat values (`BlockchainHealthCard` `Stat`) |

Rule: **one `<h1>` per page** using the page-title style, everything else steps down. No component
should introduce a one-off size like the current `text-3xl` on the admin dashboard.

---

## 5. Spacing & layout grid

Adopt the Tailwind default 4px scale but constrain page composition to a fixed set:

- Page padding: `p-6` (24px) desktop, `p-4` (16px) mobile — replace the inconsistent `p-8`/`p-6` mix.
- Card padding: `p-5` (20px), always.
- Vertical rhythm between page sections: `gap-6` / `mt-6`.
- Max content width for form-centric pages (Login, Add Ration Card): `max-w-md`–`max-w-lg`.
- Data-table pages: full width within the shell, no `max-w` cap.

---

## 6. Iconography

Replace emoji glyphs (`⚡`, `↑`, `+`) with a real icon set: **`lucide-react`** (tree-shakeable,
matches the thin/geometric style expected in enterprise UI, ~1KB/icon).

```bash
npm install lucide-react
```

Mapping for existing usages:

| Current | File | Replace with |
|---|---|---|
| `⚡ Entitlements` | [Sidebar.jsx](src/components/admin/Sidebar.jsx) | `<Zap size={16} />` |
| `↑ Bulk Upload` | [RationCards.jsx](src/pages/admin/RationCards.jsx) | `<Upload size={16} />` |
| `+ Add Ration Card` | [RationCards.jsx](src/pages/admin/RationCards.jsx) | `<Plus size={16} />` |
| Status dot | [BlockchainHealthCard.jsx](src/components/admin/BlockchainHealthCard.jsx) | keep colored dot, add `<CircleCheck>`/`<CircleAlert>`/`<CircleX>` inside the pill |
| Nav items (Dashboard, Ration Cards, Beneficiaries, Users, Areas, Shops) | [Sidebar.jsx](src/components/admin/Sidebar.jsx) | `LayoutDashboard`, `CreditCard`, `Users`, `UserCog`, `Map`, `Store` |

Icon-only buttons must always carry `aria-label`.

---

## 7. Component library

Introduce `src/components/ui/` as the single home for primitives. Every page component consumes
these instead of hand-rolling Tailwind strings. Suggested initial set:

```
src/components/ui/
  Button.jsx        # variants: primary | secondary | ghost | danger; sizes: sm | md
  Input.jsx          # text/email/password + label + error slot
  Select.jsx
  Card.jsx           # surface + border + radius-md + shadow-sm, optional header/footer
  Badge.jsx          # status pill using the semantic color tokens (§3.1)
  Table.jsx          # Table, Table.Head, Table.Row, Table.Cell — sticky header, zebra optional
  Modal.jsx          # replaces ad hoc modal markup in BulkUploadModal/AddShopkeeperModal/etc.
  EmptyState.jsx     # icon + message + optional CTA (replaces "No ration cards yet." one-offs)
  Skeleton.jsx        # replaces plain "Loading..." text
  Toast.jsx / useToast # replaces silent failures (e.g. TopBar swallowing fetch errors)
  Pagination.jsx
```

### Button

- Primary: `bg-brand-500 text-white hover:bg-brand-600` — one primary action per view.
- Secondary: `bg-surface border border-border text-text-primary hover:bg-surface-muted`.
- Danger: uses `--color-danger-*` tokens (Logout, destructive confirms).
- Disabled state always `opacity-60 cursor-not-allowed`, never removed from layout.

### Badge (status pill)

Single implementation driven by a `status` prop mapped to the semantic tokens — replaces both
`getCategoryBadgeClass` in RationCards.jsx and `STATUS_META` in BlockchainHealthCard.jsx, which
today independently reinvent the same pattern.

### Table

Standard for all list pages (RationCards, Beneficiaries, Users, Areas, Shops, Entitlements):
sticky header, `text-sm`, row hover state, right-aligned numeric columns, built-in empty/loading
slots, and pagination footer once a dataset can exceed ~50 rows.

---

## 8. Page shells

### Admin shell

- Fixed 240px dark sidebar (`--color-chrome-*` tokens) using icon+label nav, active item indicated
  by a left accent bar + `chrome-active` background (not just a background swap).
- Persistent top bar inside the light content area for page title + breadcrumb + primary action —
  currently every admin page (`RationCards.jsx`, `Dashboard.jsx`) reinvents its own header row.
- User/account menu (avatar initials, email, Logout) moves from the sidebar footer into this top
  bar for consistency with the shopkeeper shell.

### Shopkeeper shell

- Keep the top-bar pattern already in [Layout.jsx](src/components/shopkeeper/Layout.jsx) /
  [TopBar.jsx](src/components/shopkeeper/TopBar.jsx), restyle onto the same tokens as the admin
  shell so it reads as one product.
- Mobile-first: shopkeepers use this at a counter, likely on a tablet — touch targets ≥40px,
  the QR scanner view gets priority placement.

### Login

Keep the current centered-card layout ([Login.jsx](src/pages/Login.jsx)) — it's structurally
sound — but: add the product logo/wordmark above the form, move off raw `bg-gray-950`/`bg-gray-900`
to `--color-surface`/`--color-surface-sunken`, and route the error banner through the shared
`Badge`/alert pattern instead of a bespoke `bg-red-900/40` block.

---

## 9. States & feedback

- **Loading:** `Skeleton` rows matching the shape of the eventual content (table skeleton for
  tables, card skeleton for `BlockchainHealthCard`), not a centered "Loading..." string.
- **Empty:** `EmptyState` component — icon, one-line message, optional primary CTA. Used by every
  list page instead of a bespoke `<p>No X yet.</p>`.
- **Error:** inline `Badge`/alert styling for form errors (Login already close); toast for
  background/async failures that currently fail silently (e.g. `TopBar.jsx`'s shop-details fetch
  catches and drops the error with no user feedback).
- **Success:** toast on create/update/delete actions (bulk upload, add ration card, add
  shopkeeper) — none of the current modals confirm success beyond closing.

---

## 10. Forms

- Every field: label above input, `text-sm font-medium`, 4px gap, error message in
  `--color-danger-text` directly below the field.
- Required fields marked with a subtle `*`, not by contrast alone.
- Buttons: primary submit right-aligned, secondary/cancel to its left, consistent across
  `AddRationCard`, `AddShopkeeperModal`, `BulkUploadModal`, `ShopBulkUploadModal`,
  `ShopkeeperBulkUploadModal`.
- Use `react-hook-form`'s error state (already a dependency) to drive the `Input` error slot
  instead of manual `required` HTML attributes only.

---

## 11. Accessibility checklist

- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text/icons, against both light and dark surfaces.
- Every interactive element has a visible `:focus-visible` ring using `--color-brand-500`.
- Icon-only buttons (refresh, expand/collapse in `BlockchainHealthCard`) get `aria-label`.
- Modals trap focus and close on `Esc`; verify current modal components do this.
- Tables use real `<th scope="col">` (already correct) and avoid color as the only signal (pair
  badges with text, as already done — keep this pattern).

---

## 12. Rollout plan

Do this incrementally, not as a big-bang rewrite:

1. **Tokens first.** Add the `@theme` block to [index.css](src/index.css), install
   `@fontsource/inter`. No visual change breaks yet since old raw classes still work alongside
   new tokens.
2. **Primitives.** Build `src/components/ui/` (Button, Badge, Card, Input, EmptyState, Skeleton).
3. **Shell pass.** Rebuild `Sidebar.jsx`, `TopBar.jsx`, and the `AdminLayout` in `App.jsx` on the
   new tokens/primitives — this is the highest-visibility change for the least effort.
4. **List pages.** Migrate `RationCards`, `Beneficiaries`, `Users`, `Areas`, `Shops`,
   `Entitlements` onto the shared `Table` + `Badge` + `EmptyState`/`Skeleton` components.
5. **Forms & modals.** Migrate `Login`, `AddRationCard`, and the four bulk-upload/add modals onto
   `Input`/`Button`/`Modal`.
6. **Feedback layer.** Add `useToast`, wire it into the modals' success paths and previously-silent
   catch blocks (`TopBar.jsx`, `Dashboard` fetches).
7. **Polish.** Favicon/logo, dark-mode toggle, empty favicon replacement (currently Vite default).

---

## 13. Do / Don't

| Don't | Do |
|---|---|
| `className="bg-gray-900 rounded-2xl border border-gray-800 p-5"` | `<Card>` |
| `bg-blue-900 text-blue-300` inline in a `get*BadgeClass` function | `<Badge status="info">` |
| `⚡`, `+`, `↑` as button glyphs | `lucide-react` icons with `aria-label` where icon-only |
| Bespoke "Loading..."/"No X yet." per page | `<Skeleton>` / `<EmptyState>` |
| New raw Tailwind palette color in a page file | New/extended token in `@theme`, referenced everywhere |
