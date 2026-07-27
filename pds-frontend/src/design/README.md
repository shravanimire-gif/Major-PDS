# Design Foundation — contract

This is the enterprise-SaaS design system for `pds-frontend`'s admin dashboard
(Linear/Stripe-dashboard register: crisp, dense, data-first, calm). It lives
entirely under `src/design/` and is **additive** — it does not replace or
modify the pre-existing design system started in `design.md` /
`src/components/ui/` / the base `@theme` block in `src/index.css`. The two
coexist until a future prompt explicitly migrates a screen from the old
system to this one. Never mix them on the same element.

## The rules

1. **One accent hue.** `bg-ds-accent` / `text-ds-accent` / `border-ds-accent`
   (indigo-600) is the ONLY hue used for primary actions, links, and
   selection state, anywhere in this system. If you find yourself reaching
   for a second "brand-ish" color for emphasis, you're wrong — use weight,
   size, or a border instead.

2. **Status colors are status, never decoration.** `ds-success` / `ds-warning`
   / `ds-danger` / `ds-info` may only appear when they communicate an actual
   state (a health check passed, a job is pending, a request failed). Don't
   tint a card green because green "looks nice" — an all-green screen means
   nothing is highlighted. See Prompt 3's screen specs for the concrete rule:
   green only for currently-healthy, amber only for degraded/pending, red
   only for offline/critical/failed.

3. **Only `ds-*` tokens.** Never a raw Tailwind palette utility
   (`bg-gray-800`, `text-blue-400`) and never an arbitrary value
   (`bg-[#4f46e5]`, `text-[13px]`) in `src/design/**`. If a value you need
   isn't a token yet, that's a signal to add one to `tokens.css` +
   `tokens.js` together — not to reach for a one-off.

4. **Borders over shadows.** `shadow-ds-sm` is for dropdowns/popovers only.
   `shadow-ds-md` is for modals only. Cards and panels never get a shadow —
   use `border-ds-subtle` / `border-ds-default`. `shadow.none` (Tailwind's
   built-in `shadow-none`) is the default assumption for everything else.

5. **Nothing rounder than `rounded-ds-lg` (8px), and no `rounded-full`**
   except two named exceptions: avatars, and small status dots (e.g.
   `StatusPill`'s dot). A toggle `Switch`'s track is deliberately
   `rounded-ds-lg`, not pill-shaped, even though that's the common
   convention elsewhere — this app doesn't do pill switches.

6. **Never build a spinner without a state label next to it.** A bare
   spinner communicates "something is happening," not what. `Button`'s
   `loading` state keeps the label visible (dimmed, not hidden) precisely so
   the spinner always has something to describe.

7. **Never build a colored pill without a text label.** Color alone is not
   an accessible signal. `StatusPill` always renders its dot *and* a text
   label; `Badge` is text by definition. If you're tempted to ship a bare
   colored dot with no label, use a `Tooltip` at minimum, but prefer just
   adding the label.

8. **Every destructive action confirms via `Dialog`, and the copy names both
   what changes and what does not.** E.g. "Retrying will submit failed
   anchors again. It will NOT modify the underlying dispense records; those
   are already committed to the database." A confirm dialog that only says
   "Are you sure?" is not sufficient in this system.

9. **Empty states are first-class, not accidental.** If a list, panel, or
   tile can legitimately have nothing to show, design that state before the
   populated one. Use `EmptyState` for anything list/panel-shaped; use a
   plain em dash (`—`) for a single metric/value with no data. Never render
   a table with headers and zero rows and no explanation, and never
   fabricate placeholder data to avoid an empty state — an honest "no data
   yet" is always correct, invented numbers are never correct.

10. **Reduced motion is respected globally**, already wired in
    `typography.css` — you don't need to add per-component
    `prefers-reduced-motion` handling, but don't fight it either (e.g. don't
    hardcode an animation that ignores `!important`-scoped duration
    overrides).

## Token reference

See `tokens.css` (the actual Tailwind v4 `@theme` registration — the source
of truth for what utility classes exist) and `tokens.js` (a JS-value mirror
for anything that can't be a className, e.g. `recharts` series colors,
motion durations passed to a `setTimeout`). The two must stay in sync; if
you add one, add the other.

All new tokens are namespaced with `ds` (`bg-ds-canvas`, `text-ds-secondary`
→ actually `text-ds-text-secondary`, `rounded-ds-md`, `duration-ds-fast`,
etc.) specifically so they can never collide with the older, differently-valued
tokens already in use across `src/components/ui/` and `src/index.css`
(`brand-*`, `chrome-*`, `surface`, `text-primary`, `border`, `radius-sm/md`,
`shadow-sm/md`). Don't use those older tokens in new code, and don't use
`ds-*` tokens to patch old screens without an explicit migration prompt.

## Primitives

Import from the barrel: `import { Button, Card, Table } from '../design/primitives';`
(adjust the relative path to your file's location) — or import a single
primitive directly from its own file if you only need one and want to keep
the import obviously traceable.

Every primitive:
- is self-contained (only imports `react`, `lucide-react` where relevant,
  and the existing `src/components/ui/cx.js` classname-join helper — never a
  new classnames dependency);
- uses only `ds-*` tokens;
- has a JSDoc block above the component explaining when to use it;
- has a colocated `*.test.jsx` covering its states plus a `jest-axe`
  accessibility check.

Full list: `Button`, `IconButton`, `Input`, `Select`, `Textarea`,
`Checkbox`, `Radio`, `Switch`, `Badge`, `StatusPill`, `Card`,
`PanelHeader`, `Table`, `KeyValue`, `EmptyState`, `Skeleton`,
`ToastProvider`/`useToast`, `Dialog`, `Tooltip`, `Tabs`, `Breadcrumb`.

`AppShell` (`src/design/layouts/AppShell.jsx`) is the page frame — it's a
layout, not a primitive, and lives in `layouts/` rather than `primitives/`
for that reason. It is configurable (`navSections`, `breadcrumb`,
`environment`, `user` props) rather than hardcoded, so later prompts wire
real data into it without editing its internals.

## What "consume, don't modify" means for later prompts

If a later prompt needs a screen this system doesn't yet support — a new
primitive that doesn't exist (e.g. a side `Drawer`, distinct from the
centered `Dialog`), or a new composition built *from* existing primitives
(e.g. a multi-select filter built from `Checkbox`, since `Select` wraps a
native `<select>` which can't do multi-select) — adding something new that
follows this same contract is expected and fine. Editing the *behavior or
visual output* of an existing, already-consumed primitive is not — that's a
breaking change for every screen already using it, and needs its own
explicit migration prompt, not a silent tweak buried in an unrelated page's
work.
