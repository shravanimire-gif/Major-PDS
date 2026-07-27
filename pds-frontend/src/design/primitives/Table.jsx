// eslint-disable-next-line no-unused-vars -- required in scope: this project's JSX transform is classic (React.createElement), not automatic
import React from 'react';
import cx from '../../components/ui/cx';

/**
 * Table renders tabular data from a `columns` + `data` configuration rather
 * than compound child components. Use it for any data grid — device lists,
 * transaction logs, audit tables — where the column set is described once
 * and rows are plain objects. Handles its own empty state, zebra striping,
 * and an optional sticky header; callers never need to branch on whether
 * `data` is empty.
 *
 * @param {object} props
 * @param {Array<{
 *   key: string,
 *   header: string,
 *   align?: 'left'|'right',
 *   numeric?: boolean,
 *   render?: (row: object) => import('react').ReactNode
 * }>} props.columns - Column definitions. `align: 'right'` or `numeric: true` right-aligns the column (header and cells). `render`, when provided, overrides the default `row[key]` cell content.
 * @param {Array<object>} props.data - Row data. Each row object is passed to `getRowKey` and to any column's `render`.
 * @param {(row: object) => (string|number)} props.getRowKey - Returns a stable, unique key for a row.
 * @param {boolean} [props.zebra=false] - When true, alternates row backgrounds (odd/even) instead of a uniform surface.
 * @param {boolean} [props.sticky=false] - When true, pins the header row to the top of its scroll container.
 * @param {import('react').ReactNode} [props.emptyState] - Content rendered inside a single full-width row when `data` is empty, in place of any data rows.
 */
function Table({ columns, data, getRowKey, zebra = false, sticky = false, emptyState }) {
  const isRightAligned = (column) => column.align === 'right' || column.numeric;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  'px-3 py-2 text-ds-xs font-medium uppercase tracking-wide text-ds-text-tertiary border-b border-ds-subtle',
                  sticky && 'sticky top-0 z-10 bg-ds-surface',
                  isRightAligned(column) && 'text-right'
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-ds-small text-ds-text-tertiary">
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowKey(row)}
                className={cx(
                  'border-b border-ds-subtle transition-colors duration-ds-fast hover:bg-ds-surface-alt',
                  zebra && (index % 2 === 1 ? 'bg-ds-surface-alt' : 'bg-ds-surface')
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      'px-3 py-2 text-ds-small text-ds-text-primary',
                      isRightAligned(column) && 'text-right tabular-nums'
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
