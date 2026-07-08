// Collapses the 5 ad hoc radii (10, 12, 14, 16, 20) into 3 named steps
// plus a true pill.
//
// Decision on the audit's "14 vs 16" question: every card-like surface
// (Login card, Dashboard cards, SkeletonCard, the QR CTA button) is treated
// as ONE visual language and shares `md`. There's no reason for the login
// card to read as more/less rounded than a dashboard card, so instead of
// keeping them separately drifting, they're merged onto 16 (the login
// card's original value). This nudges Dashboard cards, SkeletonCard, and
// the QR CTA button from 14/12 -> 16 — flagged in the migration summary.
export const radius = {
    sm: 10, // inputs, small buttons (Login/QR CTA/refresh buttons)
    md: 16, // all card-like surfaces
    lg: 20, // the one large decorative surface (QR code box)
    pill: 999, // fully-rounded regardless of element height (category badge)
};
