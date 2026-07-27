import { describe, it, expect } from 'vitest';
import { formatRelativeTime, formatAbsoluteTime } from './relativeTime';

// Fixed reference "now" so every case is deterministic — no reliance on
// real wall-clock time.
const NOW = new Date('2026-07-23T12:00:00.000');

function secondsAgo(seconds) {
  return new Date(NOW.getTime() - seconds * 1000);
}

function minutesAgo(minutes) {
  return new Date(NOW.getTime() - minutes * 60 * 1000);
}

function hoursAgo(hours) {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

describe('formatRelativeTime', () => {
  it('formats 0 seconds ago', () => {
    expect(formatRelativeTime(secondsAgo(0), NOW)).toBe('0s ago');
  });

  it('formats a few seconds ago', () => {
    expect(formatRelativeTime(secondsAgo(45), NOW)).toBe('45s ago');
  });

  it('formats 59 seconds ago as seconds', () => {
    expect(formatRelativeTime(secondsAgo(59), NOW)).toBe('59s ago');
  });

  it('formats exactly 60 seconds ago as 1 min ago', () => {
    expect(formatRelativeTime(secondsAgo(60), NOW)).toBe('1 min ago');
  });

  it('formats 59 minutes ago as minutes', () => {
    expect(formatRelativeTime(minutesAgo(59), NOW)).toBe('59 min ago');
  });

  it('formats exactly 60 minutes ago as 1h ago', () => {
    expect(formatRelativeTime(minutesAgo(60), NOW)).toBe('1h ago');
  });

  it('formats 23 hours ago as hours', () => {
    expect(formatRelativeTime(hoursAgo(23), NOW)).toBe('23h ago');
  });

  it('formats exactly 24 hours ago as "yesterday" when it crosses into the previous calendar day', () => {
    expect(formatRelativeTime(hoursAgo(24), NOW)).toBe('yesterday');
  });

  it('formats a time yesterday morning (more than 24h before a midday "now") as "yesterday"', () => {
    // 2026-07-22T06:00 is the previous calendar day relative to
    // 2026-07-23T12:00, but the gap is 30 hours, not exactly 24 — this
    // guards against a naive "diff >= 24h && diff < 48h" implementation.
    const target = new Date('2026-07-22T06:00:00.000');
    expect(formatRelativeTime(target, NOW)).toBe('yesterday');
  });

  it('formats a date two calendar days before "now" as a plain date string, not "yesterday"', () => {
    const target = new Date('2026-07-21T12:00:00.000');
    expect(formatRelativeTime(target, NOW)).toBe(target.toLocaleDateString());
  });

  it('formats a date far in the past as a plain date string', () => {
    const target = new Date('2020-01-01T00:00:00.000');
    expect(formatRelativeTime(target, NOW)).toBe(target.toLocaleDateString());
  });

  it('accepts an ISO string for `date`', () => {
    expect(formatRelativeTime('2026-07-23T11:59:30.000', NOW)).toBe('30s ago');
  });

  it('accepts a timestamp number for `date`', () => {
    expect(formatRelativeTime(secondsAgo(10).getTime(), NOW)).toBe('10s ago');
  });

  it('defaults `now` to the current time when omitted', () => {
    const almostNow = new Date(Date.now() - 5000);
    expect(formatRelativeTime(almostNow)).toBe('5s ago');
  });
});

describe('formatAbsoluteTime', () => {
  it('returns the toLocaleString() representation for a Date', () => {
    const target = new Date('2026-07-23T11:59:30.000');
    expect(formatAbsoluteTime(target)).toBe(target.toLocaleString());
  });

  it('accepts an ISO string', () => {
    const iso = '2026-07-23T11:59:30.000';
    expect(formatAbsoluteTime(iso)).toBe(new Date(iso).toLocaleString());
  });

  it('accepts a timestamp number', () => {
    const ts = NOW.getTime();
    expect(formatAbsoluteTime(ts)).toBe(new Date(ts).toLocaleString());
  });
});
