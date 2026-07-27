// eslint-disable-next-line no-unused-vars -- required in scope: this project's JSX transform is classic (React.createElement), not automatic
import React from 'react';
import cx from '../../components/ui/cx';

// Tailwind's compiler only picks up class names it can see as complete
// static strings, so the `columns` prop is mapped through this table rather
// than interpolated (e.g. `sm:grid-cols-${columns}`) which the compiler
// would never generate CSS for.
const COLUMN_CLASS_MAP = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
  6: 'sm:grid-cols-6',
};

/**
 * KeyValue renders a labeled list of facts (label + value pairs) as a
 * semantic `<dl>`. Use it for read-only detail panels — record summaries,
 * device metadata, transaction details — anywhere a form would be overkill.
 *
 * @param {object} props
 * @param {Array<{label: string, value: import('react').ReactNode, mono?: boolean}>} props.items - The label/value pairs to render, in order. `mono: true` renders the value in the monospace numeric style used for hashes, addresses, and IDs.
 * @param {number} [props.columns=2] - Number of grid columns at the `sm` breakpoint and above; stacks to a single column below it.
 */
function KeyValue({ items, columns = 2 }) {
  const columnsClassName = COLUMN_CLASS_MAP[columns] ?? COLUMN_CLASS_MAP[2];

  return (
    <dl className={cx('grid grid-cols-1 gap-4', columnsClassName)}>
      {items.map((item, index) => (
        <div key={index} className="flex flex-col gap-1">
          <dt className="text-ds-xs font-medium uppercase tracking-wide text-ds-text-tertiary">{item.label}</dt>
          <dd
            className={cx(
              item.mono ? 'font-mono-ds text-ds-mono-sm text-ds-text-primary' : 'text-ds-body text-ds-text-primary'
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default KeyValue;
