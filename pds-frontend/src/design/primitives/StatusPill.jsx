// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import cx from '../../components/ui/cx';

const DOT_CLASSES = {
  online: 'bg-ds-success',
  degraded: 'bg-ds-warning',
  offline: 'bg-ds-danger',
  unknown: 'bg-ds-text-disabled',
};

const TEXT_CLASSES = {
  online: 'text-ds-success',
  degraded: 'text-ds-warning',
  offline: 'text-ds-danger',
  unknown: 'text-ds-text-secondary',
};

const SIZE_CLASSES = {
  sm: { dot: 'h-1.5 w-1.5', text: 'text-ds-xs', gap: 'gap-1.5' },
  md: { dot: 'h-2 w-2', text: 'text-ds-small', gap: 'gap-2' },
};

/**
 * Compact dot + label indicator for connection/health status, used in
 * health panels and device tables. Always renders a text label alongside
 * the colored dot so status is never conveyed by color alone.
 *
 * @param {Object} props
 * @param {'online'|'degraded'|'offline'|'unknown'} props.status - The status the pill represents.
 * @param {string} props.label - Text label rendered next to the dot.
 * @param {'sm'|'md'} [props.size='sm'] - Size of the dot and label text.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function StatusPill({ status, label, size = 'sm', className, ...props }) {
  const sizing = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;

  return (
    <span
      className={cx('inline-flex items-center', sizing.gap, className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cx('inline-block rounded-full', sizing.dot, DOT_CLASSES[status] ?? DOT_CLASSES.unknown)}
      />
      <span
        className={cx(
          'font-medium uppercase tracking-wide',
          sizing.text,
          TEXT_CLASSES[status] ?? TEXT_CLASSES.unknown
        )}
      >
        {label}
      </span>
    </span>
  );
}

export default StatusPill;
