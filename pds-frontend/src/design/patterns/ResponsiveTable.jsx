// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses when running under vitest's own internal Vite.
import React, { useSyncExternalStore } from 'react';
import Table from '../primitives/Table';
import KeyValue from '../primitives/KeyValue';
import Card from '../primitives/Card';

const MOBILE_BREAKPOINT_PX = 640;

// matchMedia is exactly the "subscribe to an external system, read a
// snapshot" case useSyncExternalStore exists for — it avoids the
// subscribe-then-setState-in-an-effect pattern entirely rather than
// working around it.
function useIsBelow(breakpointPx) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches,
    () => false
  );
}

/**
 * A list-page pattern, not a primitive: below 640px it renders each row as a
 * small Card of KeyValue pairs instead of a Table, per the "tables become
 * card-list fallbacks on small screens, uniformly across every list page"
 * rule. Composes the existing Table/KeyValue/Card primitives rather than
 * modifying Table itself, so this lives in `patterns/`, not `primitives/`.
 *
 * @param {Object} props
 * @param {Array<{ key: string, header: string, align?: 'left'|'right', numeric?: boolean, render?: (row: any) => React.ReactNode, mono?: boolean }>} props.columns - Same column shape Table expects, plus an optional `mono` flag used only in the card view (identifiers render in monospace).
 * @param {Array<any>} props.data
 * @param {(row: any) => string|number} props.getRowKey
 * @param {boolean} [props.zebra]
 * @param {boolean} [props.sticky]
 * @param {React.ReactNode} [props.emptyState]
 */
function ResponsiveTable({ columns, data, getRowKey, zebra, sticky, emptyState }) {
  const isMobile = useIsBelow(MOBILE_BREAKPOINT_PX);

  if (!isMobile) {
    return <Table columns={columns} data={data} getRowKey={getRowKey} zebra={zebra} sticky={sticky} emptyState={emptyState} />;
  }

  if (data.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((row) => (
        <Card key={getRowKey(row)}>
          <KeyValue
            columns={2}
            items={columns.map((column) => ({
              label: column.header,
              value: column.render ? column.render(row) : row[column.key],
              mono: column.mono,
            }))}
          />
        </Card>
      ))}
    </div>
  );
}

export default ResponsiveTable;
