# PDS Beneficiary App — Current Design Audit

Scope: `test/pds-beneficiary` — the beneficiary-facing Expo/React Native app (3 screens: Login, Dashboard, QR). This document records the **current** visual design as implemented in code, as a baseline before the enterprise redesign.

## 1. Stack relevant to UI

- Expo SDK 54, React Native 0.81.5, React 19.
- Navigation: `@react-navigation/native-stack`, headers disabled (`headerShown: false`) — each screen builds its own header manually.
- QR rendering: `react-native-qrcode-svg` + `react-native-svg`.
- Installed but **not currently used anywhere in the code**: `expo-linear-gradient`, `expo-haptics`, `react-native-reanimated` (only pulled in transitively by navigation/screens; no screen imports it directly). These look like polish that was planned but never wired up.
- No icon library in use (`@expo/vector-icons` ships free with Expo but is not imported anywhere) — all icons are raw emoji glyphs.
- No theme/design-token file of any kind. Every screen defines its own `StyleSheet.create({...})` with hardcoded literals; colors, spacing, and radii are copy-pasted across files rather than shared.
- `userInterfaceStyle` is locked to `"light"` in `app.json` — no dark mode.
- No localization (i18n) — all strings are hardcoded English.

## 2. Color usage (no central palette exists)

| Role | Value(s) | Where used |
|---|---|---|
| Primary | `#1a73e8` | Headers (Dashboard, QR), all primary buttons, links, spinners, active timer text, splash `AppNavigator` loading indicator |
| Screen background | `#f0f4ff` | Container background on all 3 screens |
| Surface / card | `#ffffff` | Login card, Dashboard cards, QR code box |
| Text — primary | `#1a1a2e` | Titles, names, card titles |
| Text — secondary | `#666`, `#888`, `#555`, `#444`, `#aaa` | Five different greys used interchangeably for "muted" text with no defined rule for which to use where |
| Border / divider | `#dde3f0` (inputs, skeleton), `#f0f0f0` (list row dividers) | Login input border, SkeletonCard fill, Dashboard row separators |
| Danger / error | `#e53935` | Logout button outline/text, QR expired state, timer red state |
| Category badges (Dashboard only) | APL `#2196F3`, BPL `#FF9800`, AAY `#F44336` | `CATEGORY_COLOR` map, local to `DashboardScreen.js` |
| Grain colors (Dashboard wallet) | Rice `#4CAF50`, Wheat `#FF9800` | `GrainItem` calls in `DashboardScreen.js` |

Notable inconsistency: the AAY badge red (`#F44336`) and the app's "danger" red (`#e53935`) are two different reds for what is conceptually the same semantic color. Wheat's orange (`#FF9800`) and the BPL badge orange are the same value but coincidentally, not by shared reference.

## 3. Typography (no type scale)

No custom font is loaded; the OS default (San Francisco on iOS, Roboto on Android) is used throughout.

Font sizes currently in use, largest to smallest — **12 distinct values, no named scale**:
`40` (login emoji logo) · `32` (QR timer value) · `28` (grain value) · `22` (login title, dashboard beneficiary name) · `18` (QR header title) · `17` (QR CTA text) · `16` (button labels, inputs, timer label) · `15` (dashboard card titles, family member name, logout label) · `14` (subtitles, member age, transaction shop name, hint text) · `13` (greeting, badge text, grain label) · `12` (card number, grain unit, transaction date/qty).

Font weights used: unstated default (~400), `600`, `700`, `800` — applied inconsistently (e.g. card titles are `700` in one place and button labels `600` elsewhere with the same visual prominence).

## 4. Spacing (no spacing scale)

Raw padding/margin values found across the three screens: `4, 6, 8, 10, 12, 14, 15, 16, 18, 20, 24, 28, 32` — 13 distinct pixel values with no 4pt/8pt grid discipline. Example: Login's button padding is `15` while QR's is `14` for a visually identical control.

## 5. Border radius (inconsistent)

`10` (inputs, Login/QR buttons) · `12` (skeleton cards) · `14` (Dashboard cards, QR CTA) · `16` (Login card) · `20` (category badge pill, QR code box) — five radii with no documented hierarchy (unclear if 14 vs 16 is intentional or accidental).

## 6. Elevation / shadow (inconsistent)

Three different ad hoc shadow "levels" appear, each defined inline rather than as a shared token:
- Login card: `shadowOpacity 0.08, shadowRadius 12, elevation 4`
- Dashboard cards: `shadowOpacity 0.06, shadowRadius 8, elevation 2`
- QR code box: `shadowOpacity 0.1, shadowRadius 16, elevation 6`

## 7. Iconography

100% emoji, no vector icon set:
🌾 (login logo **and** wallet card title — same glyph, two different meanings) · 📱 (generate QR) · 👨‍👩‍👧 (family) · 📋 (transactions) · 👋 (greeting) · ⭐ (head-of-family marker) · 🌿 (wheat, only in the transaction row, not the wallet card) · ⏰ (QR expired) · 🔄 (refresh) · `←` (back — plain text glyph, not an icon).

Emoji rendering differs across iOS/Android/OEM emoji sets, which is the single biggest reason the app currently reads as a prototype rather than a branded enterprise product.

## 8. Screen-by-screen inventory

### LoginScreen (`src/screens/LoginScreen.js`)
- Full-screen `KeyboardAvoidingView` on lavender background, one centered white card (radius 16, padding 28, soft shadow).
- Two-step flow (mobile number → OTP) driven by local `step` state; no visual stepper/progress indicator communicates this to the user.
- Single generic 6-digit `TextInput` for OTP — not the segmented 6-box OTP pattern common in enterprise auth flows.
- All errors surface via native `Alert.alert` (unstyleable system modal).
- Loading state: button label is swapped for an `ActivityIndicator` in place.
- No logo image, no illustration — text + emoji only.

### DashboardScreen (`src/screens/DashboardScreen.js`)
- `SafeAreaView` → `ScrollView` (pull-to-refresh) with a non-scrolling Logout button pinned below the scroll area.
- Header: flat blue rectangle (greeting, beneficiary name, card number, category badge). No avatar/profile image.
- Wallet card: title + 2-column rice/wheat values — plain numbers, no progress bar or "% of entitlement used" visualization.
- Full-width QR CTA button sits between the wallet and family cards, styled with the same blue as the header.
- Family card: plain text rows, head-of-household flagged with ⭐.
- Transactions card: last 5 entries, no "view all," no per-commodity icon consistency with the wallet card.
- Loading state: 4 stacked animated `SkeletonCard` placeholders — the one genuinely polished pattern in the app today.
- Errors: generic `Alert.alert`; a 401 response triggers a silent logout.

### QRScreen (`src/screens/QRScreen.js`)
- Header bar (blue, back + title) + centered body.
- QR code in a white rounded shadowed box, or an emoji+text "expired" state.
- Live countdown (60s), turns red at ≤10s remaining.
- Manual "Refresh QR" button — **the countdown does not auto-refresh** when it hits zero, the user must tap.
- No haptic feedback on refresh/expiry despite `expo-haptics` being an installed dependency.
- No transition/animation between the QR and expired states (instant swap).

### Shared component
- `SkeletonCard` (`src/components/SkeletonCard.js`) — the only reusable UI component in the app; a pulsing grey placeholder block. Everything else (buttons, cards, badges, inputs) is redefined per screen.

## 9. Why this doesn't read as "enterprise" today

1. No design-token source of truth (colors/typography/spacing/radius all copy-pasted per screen, already drifting — see §2–§6).
2. No reusable primitives — Button, Card, Input, Badge, ScreenHeader are each hand-rolled 1–3 times instead of shared.
3. Emoji-as-icons instead of a vector icon set (`@expo/vector-icons` is free and already bundled with Expo but unused).
4. No dark mode.
5. No accessibility labels/roles on touchables, inputs, or status indicators.
6. Native `Alert.alert` for every error/success message instead of in-app toasts/snackbars or inline field validation.
7. No brand identity: no custom font, no logo mark, no illustrations for empty states (just plain text like "No transactions yet").
8. Two design-relevant dependencies (`expo-linear-gradient`, `expo-haptics`) are installed but never used — likely intended polish that never landed.
9. English-only strings with no i18n layer, despite beneficiaries being a predominantly Hindi/regional-language user base.

## 10. Assets

`assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png` — these are the default Expo template placeholder graphics, not custom brand assets.

---

## Redesign priorities (proposed next steps)

Not yet implemented — for discussion before starting the actual redesign:

1. **Design tokens** — a single `src/theme/` module (colors, type scale, spacing scale, radius, elevation) that every screen imports instead of redefining.
2. **Primitive component library** — shared `Button`, `Card`, `Input`, `Badge`, `ScreenHeader`, `Toast` components used by all 3 screens.
3. **Real icon set** — replace every emoji with `@expo/vector-icons` (or a chosen icon pack) for a consistent, brand-controlled look across OS/devices.
4. **Wire up the unused dependencies** — subtle `expo-linear-gradient` header treatment, `expo-haptics` feedback on key actions (OTP submit, QR refresh, logout).
5. **Auth flow polish** — segmented OTP input, step indicator, inline validation instead of `Alert.alert`.
6. **Dashboard visual hierarchy** — entitlement progress bars for the wallet card, avatar placeholders for family members, a proper empty-state illustration for transactions.
7. **QR screen** — auto-refresh on expiry, haptic pulse at ≤10s, animated state transition.
8. **Accessibility pass** — labels/roles on all interactive elements, verified color contrast.
9. **Dark mode** (optional, scope to confirm).

Let me know which of these you want to prioritize (or if you have a specific enterprise design language / component library in mind — e.g. Material 3 via React Native Paper, or a fully custom token system) and I'll start implementing the redesign.
