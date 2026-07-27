// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import cx from '../../components/ui/cx';

const TONE_CLASSES = {
  neutral: 'bg-ds-sunken text-ds-text-secondary',
  info: 'bg-ds-info/10 text-ds-info',
  success: 'bg-ds-success/10 text-ds-success',
  warning: 'bg-ds-warning/10 text-ds-warning',
  danger: 'bg-ds-danger/10 text-ds-danger',
};

const SIZE_CLASSES = {
  sm: 'px-1.5 py-0.5',
  md: 'px-2 py-1',
};

/**
 * Small inline label for tags, counts, or metadata (e.g. a device type,
 * a count of items, a short status word). Not for long-running connection
 * status — use StatusPill for that.
 *
 * @param {Object} props
 * @param {'neutral'|'info'|'success'|'warning'|'danger'} [props.tone='neutral'] - Color tone of the badge.
 * @param {'sm'|'md'} [props.size='sm'] - Size of the badge, controls padding.
 * @param {React.ReactNode} props.children - Badge content.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function Badge({ tone = 'neutral', size = 'sm', children, className, ...props }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-ds-sm text-ds-xs font-medium uppercase tracking-wide tabular-nums',
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral,
        SIZE_CLASSES[size] ?? SIZE_CLASSES.sm,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
