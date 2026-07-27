// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses when running under vitest's own internal Vite.
import React from 'react';
import Card from '../primitives/Card';
import cx from '../../components/ui/cx';

const TONE_VALUE_CLASSES = {
  neutral: 'text-ds-text-primary',
  success: 'text-ds-success',
  warning: 'text-ds-warning',
  danger: 'text-ds-danger',
};

/**
 * The single metric-strip tile used across Dashboard/Blockchain/IoT/Anchors —
 * built on Card so every "big number + caption" tile in the app looks and
 * behaves the same. Implements the "numbers are the design" rule: a small
 * uppercase label, a large tabular-nums value, and an optional comparison
 * line underneath. Per the color-discipline rule, `tone` colors only the
 * value text (never the tile background) and should stay reserved for
 * genuinely meaningful state — success for a currently-healthy state,
 * warning for degraded/pending, danger for offline/critical/failure.
 *
 * Deliberately has no chart/sparkline slot: per spec, a sparkline is only
 * ever justified by dense underlying data (>20 points), which no current
 * caller has, so this component doesn't grow an unused slot for one.
 *
 * @param {Object} props
 * @param {string} props.label - Short caption above the value (rendered uppercase).
 * @param {string|number} props.value - The primary number/metric, rendered at display size.
 * @param {string} [props.comparison] - Optional small text below the value, e.g. "+12 vs yesterday", "3 pending", "no change in 24h".
 * @param {'neutral'|'success'|'warning'|'danger'} [props.tone='neutral'] - Colors the value text only.
 * @param {() => void} [props.onClick] - When provided, the tile renders as a clickable <button> (e.g. Dashboard's "Open anomalies" tile) instead of a static container.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function MetricTile({ label, value, comparison, tone = 'neutral', onClick, className }) {
  const valueToneClass = TONE_VALUE_CLASSES[tone] ?? TONE_VALUE_CLASSES.neutral;

  const content = (
    <>
      <p className="text-ds-xs uppercase tracking-wide text-ds-text-tertiary font-medium">{label}</p>
      <p className={cx('text-ds-display font-semibold tabular-nums', valueToneClass)}>{value}</p>
      {comparison && <p className="mt-1 text-ds-body text-ds-text-secondary">{comparison}</p>}
    </>
  );

  if (onClick) {
    return (
      <Card
        className={cx('p-0 overflow-hidden', className)}
      >
        <button
          type="button"
          onClick={onClick}
          className={cx(
            'w-full h-full text-left p-5',
            'transition-colors duration-ds-fast ease-ds-standard',
            'hover:bg-ds-surface-alt',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
          )}
        >
          {content}
        </button>
      </Card>
    );
  }

  return <Card className={className}>{content}</Card>;
}

export default MetricTile;
