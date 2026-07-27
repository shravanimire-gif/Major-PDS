const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * Normalizes the accepted `date` shapes (Date instance, ISO string, epoch
 * timestamp number) into a Date instance.
 *
 * @param {Date|string|number} date
 * @returns {Date}
 */
function toDate(date) {
  return date instanceof Date ? date : new Date(date);
}

/**
 * Returns true when `date` falls on the calendar day immediately before
 * `now`'s calendar day (i.e. "yesterday"), regardless of the time-of-day
 * difference between them.
 *
 * @param {Date} date
 * @param {Date} now
 * @returns {boolean}
 */
function isYesterday(date, now) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayMs = 24 * HOUR_MS;
  return startOfToday.getTime() - startOfDate.getTime() === dayMs;
}

/**
 * Use anywhere a short "time ago" label is shown for a past timestamp (log
 * rows, activity feeds, "last updated" columns) — e.g. via the RelativeTime
 * pattern component. Accepts a Date, ISO string, or epoch number for `date`.
 * Pass an explicit `now` for deterministic output (tests should always do
 * this); production callers can omit it to compare against the current time.
 *
 * Buckets: under 60s -> "Xs ago", under 60min -> "X min ago", under 24h ->
 * "Xh ago", exactly the previous calendar day -> "yesterday", otherwise a
 * plain localized date string.
 *
 * @param {Date|string|number} date - The past timestamp to describe.
 * @param {Date} [now=new Date()] - The reference "current" time; pass explicitly in tests.
 * @returns {string}
 */
export function formatRelativeTime(date, now = new Date()) {
  const target = toDate(date);
  const diffMs = now.getTime() - target.getTime();

  if (diffMs < MINUTE_MS) {
    const seconds = Math.max(0, Math.floor(diffMs / SECOND_MS));
    return `${seconds}s ago`;
  }
  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${minutes} min ago`;
  }
  if (diffMs < 24 * HOUR_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${hours}h ago`;
  }
  if (isYesterday(target, now)) {
    return 'yesterday';
  }
  return target.toLocaleDateString();
}

/**
 * Use as the Tooltip content next to a RelativeTime label, so hovering (or
 * focusing) the short "Xh ago" text reveals the full, unambiguous timestamp.
 *
 * @param {Date|string|number} date - The timestamp to render in full.
 * @returns {string}
 */
export function formatAbsoluteTime(date) {
  return toDate(date).toLocaleString();
}
