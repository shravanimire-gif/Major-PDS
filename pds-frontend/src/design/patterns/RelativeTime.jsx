// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React from 'react';
import Tooltip from '../primitives/Tooltip';
import { formatRelativeTime, formatAbsoluteTime } from '../../lib/relativeTime';

/**
 * Compact "time ago" label for timestamp columns and activity feeds (e.g.
 * "4s ago", "12 min ago", "yesterday") that reveals the full absolute
 * timestamp in a Tooltip on hover/focus. Use this instead of formatting
 * dates ad hoc anywhere a past timestamp is displayed.
 *
 * @param {Object} props
 * @param {Date|string|number} props.value - The timestamp to describe.
 * @param {Date} [props.now] - Optional reference "current" time, passed through to formatRelativeTime for deterministic rendering in tests.
 */
function RelativeTime({ value, now }) {
  // Passing `now` through even when undefined is safe: formatRelativeTime's
  // own default parameter (`now = new Date()`) applies whenever the argument
  // is undefined, same as omitting it entirely.
  const relative = formatRelativeTime(value, now);
  const absolute = formatAbsoluteTime(value);

  return (
    <Tooltip content={absolute}>
      <span className="text-ds-small text-ds-text-secondary">{relative}</span>
    </Tooltip>
  );
}

export default RelativeTime;
