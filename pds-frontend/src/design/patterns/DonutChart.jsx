// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import cx from '../../components/ui/cx';
import { colors } from '../tokens';

const SLOT_COLORS = colors.chart.series;
const OTHER_COLOR = colors.chart.other;

/**
 * DonutChart — a compact category-breakdown donut with an always-visible
 * text legend (identity is never color-alone) and a centered total. Used on
 * the admin Dashboard to give a "who is this system serving" glance —
 * beneficiaries by NFSA category, beneficiaries by area — with each row
 * doubling as a filter into a fuller list when `onSliceClick` is passed.
 *
 * Caps at 3 named series plus one optional trailing `isOther` slice: a
 * donut exposes every slice next to every other, and 3 is the largest set
 * of `tokens.js` `chart.series` hues that clears the CVD floor under that
 * all-pairs comparison. Callers must pre-fold anything past 3 real
 * categories into a single `{ label: 'Other', value, isOther: true }`
 * entry — this component does not do that folding itself, since only the
 * caller knows which of its categories are least important to name.
 *
 * @param {object} props
 * @param {{label: string, value: number, isOther?: boolean, [key: string]: any}[]} props.data - up to 3 named slices, plus an optional trailing `isOther` slice. Extra fields (e.g. an `id`) pass through to `onSliceClick` untouched.
 * @param {string} [props.totalLabel='Total'] - Caption under the centered total (e.g. "Beneficiaries").
 * @param {(slice: object) => void} [props.onSliceClick] - When provided, every non-"Other" row becomes a button that calls back with that slice's original data plus its computed `percentage`.
 * @param {string} [props.className] - Additional classes applied to the outer container.
 */
function DonutChart({ data, totalLabel = 'Total', onSliceClick, className }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let colorIndex = 0;
  const withColor = data.map((d) => ({
    ...d,
    color: d.isOther ? OTHER_COLOR : SLOT_COLORS[colorIndex++ % SLOT_COLORS.length],
    percentage: total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0,
  }));

  const isEmpty = total === 0;

  return (
    <div className={cx('flex flex-col items-center gap-4 sm:flex-row sm:items-center', className)}>
      <div className="relative h-40 w-40 flex-shrink-0">
        {isEmpty ? (
          <div className="flex h-full w-full items-center justify-center rounded-ds-lg border border-dashed border-ds-border-subtle text-center text-ds-xs text-ds-text-tertiary">
            No data yet
          </div>
        ) : (
          <PieChart width={160} height={160}>
            <Pie
              data={withColor}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={2}
              cornerRadius={3}
              stroke="var(--color-ds-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {withColor.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => [
                `${Number(value).toLocaleString()} (${entry.payload.percentage}%)`,
                entry.payload.label,
              ]}
              contentStyle={{
                background: 'var(--color-ds-surface)',
                border: '1px solid var(--color-ds-border-default)',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </PieChart>
        )}
        {!isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-ds-title font-semibold tabular-nums text-ds-text-primary">
              {total.toLocaleString()}
            </span>
            <span className="text-ds-xs uppercase tracking-wide text-ds-text-tertiary">{totalLabel}</span>
          </div>
        )}
      </div>

      <ul className="w-full flex-1 space-y-1.5">
        {withColor.map((slice) => {
          const rowContent = (
            <>
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-ds-sm"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-ds-body text-ds-text-primary">{slice.label}</span>
              <span className="text-ds-body font-medium tabular-nums text-ds-text-primary">
                {slice.value.toLocaleString()}
              </span>
              <span className="w-12 text-right text-ds-small tabular-nums text-ds-text-tertiary">
                {slice.percentage}%
              </span>
            </>
          );

          return (
            <li key={slice.label}>
              {onSliceClick && !slice.isOther ? (
                <button
                  type="button"
                  onClick={() => onSliceClick(slice)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-ds-sm px-1.5 py-1 text-left',
                    'transition-colors duration-ds-fast ease-ds-standard',
                    'hover:bg-ds-surface-alt',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent'
                  )}
                >
                  {rowContent}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1.5 py-1">{rowContent}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DonutChart;
