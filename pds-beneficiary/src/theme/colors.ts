// Semantic color tokens. Raw hex values are only allowed to live here —
// every screen/component should reference a name below, never a literal.

// Shared primitives so the two audit-flagged inconsistencies are resolved
// by construction (one value, referenced from every place it's needed)
// instead of by convention.
//
// Phase 2 accessibility pass: danger/warning/success were darkened from
// their Phase 1 values (#e53935/#FF9800/#4CAF50) after a WCAG AA contrast
// sweep found each failed against white at the sizes they're actually used
// at. New values keep the same hue family, just enough darker to clear the
// bar. See the Phase 2 summary for the full before/after contrast table.
const DANGER = "#da3632"; // was #e53935 (4.23:1 on white) -> 4.61:1
const WARNING = "#cc7a00"; // was #FF9800 (2.16:1 on white) -> 3.31:1
const SUCCESS = "#459f49"; // was #4CAF50 (2.78:1 on white) -> 3.33:1

export const colors = {
    primary: "#1a73e8",
    // Derived (0.72x) darker primary, used only as the second gradient
    // stop for the login header treatment — not a new arbitrary hue.
    primaryDark: "#1353a7",
    background: "#f0f4ff",
    surface: "#ffffff",
    // Distinct from `surface`: the very light blue-white fill used only
    // behind text inputs (was a one-off literal, #f8f9ff, in LoginScreen).
    surfaceAlt: "#f8f9ff",

    textPrimary: "#1a1a2e",
    // Collapses the five ad hoc greys (#666/#888/#555/#444/#aaa) into two
    // deliberate steps. textSecondary absorbs #666/#555/#444 (all "readable
    // secondary text"); textMuted absorbs #888/#aaa (all "de-emphasized").
    textSecondary: "#666666",
    // Phase 2: was #999999 (2.85:1 on white — fails AA even for large
    // text). Darkened to clear 4.5:1 for the small regular-weight text it's
    // actually used on (grain unit, tx date, hint, empty-state copy).
    textMuted: "#747474",

    // Text/icons drawn directly on `primary`-colored surfaces (headers,
    // buttons). Kept as its own token so primitives never hardcode white.
    // Phase 1 also had onPrimaryMuted/onPrimarySubtle (translucent white)
    // for de-emphasized header text (greeting, card number). Phase 2 audit:
    // full-opacity white on `primary` is already only 4.51:1 — any
    // translucency drops below the 4.5:1 floor for regular-weight text, so
    // there is no compliant "muted-on-primary" variant on this blue. Those
    // two tokens are removed; screens use `onPrimary` for that text too and
    // convey hierarchy via size/weight instead of opacity.
    onPrimary: "#ffffff",

    // Consolidates the two divider/border roles the audit grouped together
    // (input border + skeleton fill vs. list-row dividers) into one value.
    border: "#dde3f0",

    danger: DANGER,
    warning: WARNING,
    success: SUCCESS,

    // Dark, opaque surface for the Toast primitive (a snackbar reads best
    // on a near-black surface regardless of light/dark screen background).
    // Reuses textPrimary's near-black rather than inventing a new hex.
    inverseSurface: "#1a1a2e",
    onInverseSurface: "#ffffff",

    category: {
        apl: "#2196F3",
        bpl: WARNING,
        aay: DANGER, // was #F44336; now shares the app's one danger red
    },
    grain: {
        rice: SUCCESS,
        wheat: WARNING,
    },

    // Deterministic background palette for initials avatars. All 6 clear
    // >=3:1 against white initials text (verified for bold ~16px text).
    avatarPalette: ["#1a73e8", "#2196F3", "#cc7a00", "#da3632", "#459f49", "#9C27B0"],
};
