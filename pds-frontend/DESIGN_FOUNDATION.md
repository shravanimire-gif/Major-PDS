# Design Foundation — how later prompts consume this

This documents the Prompt-1 deliverable: `src/design/` — tokens, primitives,
and the `AppShell` layout. It does not change any existing screen; nothing
here is wired into `src/App.jsx` yet. See `src/design/README.md` for the
design *rules* (one accent hue, no shadows on cards, empty states, etc.) —
this file is about *how to plug into it*, not what the rules are.

## Relationship to the pre-existing design system

This repo already had a design-system effort in flight (`design.md`,
`src/components/ui/`, and a `@theme` block in `src/index.css` — brand blue
`#2f6feb`, dark sidebar/chrome tokens, 6/10/16px radii, shadows on cards).
That system is untouched and still fully functional; every existing screen
still renders exactly as before. `src/design/` is a **second, additive**
token/component layer with intentionally non-colliding names (everything is
`ds`-namespaced) representing the new Linear/Stripe-style direction. The two
systems will coexist until a future prompt explicitly migrates a screen from
old to new — do not use both on the same element, and do not "helpfully"
backport a `ds-*` token into an old `src/components/ui/` file or vice versa.

## Consuming tokens

- **Styling**: use the `ds-*` Tailwind utility classes directly in
  className strings (`bg-ds-surface`, `text-ds-text-secondary`,
  `border-ds-subtle`, `rounded-ds-lg`, `shadow-ds-md`, `duration-ds-fast`,
  `ease-ds-standard`, `font-mono-ds`, `text-ds-title`, etc.). These come
  from `src/design/tokens.css`, imported into the global stylesheet via two
  new lines in `src/index.css` (`@import "./design/tokens.css";` and
  `@import "./design/typography.css";`) — you don't need to import anything
  yourself to use these classes in a component.
- **Raw values in JS** (chart series colors, a `setTimeout` duration, etc.,
  where a className isn't applicable): `import { colors, typography,
  motion, radii, shadows, spacing } from '../design/tokens';` (adjust the
  relative path). Every key here has a matching CSS custom property in
  `tokens.css` — if you ever need a new one, add it to both files together.
- **Fonts**: Inter (400/500/600) and JetBrains Mono (400) are loaded via
  `@fontsource` imports in `typography.css`. `tabular-nums` is already
  global on `<body>`, `<td>`, `<input>`, and `.mono`.

## Consuming primitives

```js
import { Button, Card, Table, PanelHeader, EmptyState } from '../design/primitives';
```

Or import a single file directly (`from '../design/primitives/Button'`) if
you only need one. Every primitive's prop shape is documented via JSDoc in
its own file — read the component file itself as the API reference rather
than relying on a summary here, since summaries drift and the JSDoc won't.

Full set: `Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Checkbox`,
`Radio`, `Switch`, `Badge`, `StatusPill`, `Card`, `PanelHeader`, `Table`,
`KeyValue`, `EmptyState`, `Skeleton`, `ToastProvider`/`useToast`, `Dialog`,
`Tooltip`, `Tabs`, `Breadcrumb`.

Notable API shapes worth knowing before you reach for them:
- `Table` is data-driven (`columns`, `data`, `getRowKey`, `zebra`, `sticky`,
  `emptyState`) — not a compound `<Table.Row>` component. It renders your
  `emptyState` node itself when `data` is empty; you never conditionally
  render `<Table>` vs `<EmptyState>` yourself.
- `Tabs` takes `items: [{ key, label, content }]` and renders both the tab
  list and the active panel — it's not a compound component either.
- `ToastProvider` must wrap whatever tree needs `useToast()`; it is not
  mounted globally yet (no prompt has wired it into `AppShell` or `App.jsx`
  — do that explicitly wherever you need toasts, or as part of wiring
  `AppShell` in).
- `Dialog` and `Tooltip` are the only two primitives with overlay/portal-ish
  behavior; there is no `Drawer` yet — if a later screen needs a side panel,
  that's a new primitive to add (see `src/design/README.md`'s "what
  consume-don't-modify means" section), not a `Dialog` variant.

## Consuming AppShell

`src/design/layouts/AppShell.jsx` is a layout, not a primitive (hence its
own `layouts/` directory) — it's configurable rather than hardcoded so a
routing prompt can wire real data in without editing its internals:

```jsx
<AppShell
  navSections={[{ title: 'OVERVIEW', items: [{ label: 'Dashboard', to: '/admin', icon: <LayoutDashboard size={16}/> }] }]}
  breadcrumb={<Breadcrumb items={[{ label: 'Health' }, { label: 'Blockchain' }]} />}
  environment={import.meta.env.MODE === 'production' ? 'production' : 'development'}
  user={{ name: currentUser.name }}
>
  {/* page content */}
</AppShell>
```

It is **not** wired into `src/App.jsx` yet — the current admin route tree
still uses the old inline `AdminLayout` (dark `Sidebar` + `AdminTopBar`).
Swapping that over, populating `navSections` with the real IA, and deriving
`breadcrumb` from the route is explicitly a routing prompt's job, not
something to do incidentally while building a single page.

## Testing

Vitest is configured via `vitest.config.js` (project root) +
`src/design/test/setup.js` (registers `@testing-library/jest-dom` matchers
and `jest-axe`'s `toHaveNoViolations` globally — don't re-register either in
individual test files). Run `npm test` (`vitest run`) or `npm run
test:watch`. Every primitive has a colocated `*.test.jsx` covering its
states plus one `jest-axe` accessibility assertion — follow that pattern for
new primitives/pages rather than introducing a different testing style.

One environment fix worth knowing about: Vitest's internally-bundled Vite
doesn't negotiate the same JSX-runtime config as the project's top-level
Vite 8 + `@vitejs/plugin-react` v6, so early files in this design system
carry a defensive `import React from 'react'` (with an
`eslint-disable-next-line no-unused-vars`) purely to satisfy Vitest's
fallback-to-classic-runtime behavior. This is now fixed at the root via
`esbuild: { jsx: 'automatic', jsxImportSource: 'react' }` in
`vitest.config.js` — **new files do not need the workaround import**. The
existing ones were left as-is (harmless, just redundant) rather than
churned for no functional reason.

## What's NOT part of this foundation yet

- Nothing is wired into routing (`src/App.jsx` still points at the old
  `AdminLayout`/`Sidebar`/`AdminTopBar`).
- No page has been migrated to consume any of this.
- No `Drawer` primitive, no multi-select filter composition, no
  auto-refresh/relative-time/hash-truncation utilities — these get added by
  whichever later prompt first needs them, following the same `ds-*`-only,
  self-contained, JSDoc-documented, colocated-test contract established
  here.
