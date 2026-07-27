// Shared by the new IoT admin pages (fleet/sessions/anomalies) per Phase 3's
// UX rule: "timestamps in the shop's local time zone with UTC on hover."
// This deployment is India-only (see PHASE3_DONE.md — no per-shop timezone
// exists anywhere, matching the one precedent in the codebase,
// entitlementCron.js's hardcoded "Asia/Kolkata"), so "shop local time" is a
// fixed IST formatting, not a per-shop lookup. UTC rides in the native
// `title` attribute — a real tooltip on hover, no new component needed.
const TIMEZONE = 'Asia/Kolkata';

const ShopTimestamp = ({ value, fallback = '—', className }) => {
    if (!value) {
        return <span className={className}>{fallback}</span>;
    }

    const date = new Date(value);
    const localText = date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: TIMEZONE,
    });
    const utcText = date.toISOString().replace('T', ' ').replace('Z', ' UTC');

    return (
        <span className={className} title={utcText}>
            {localText} IST
        </span>
    );
};

export default ShopTimestamp;
