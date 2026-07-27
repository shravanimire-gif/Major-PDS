// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { useEffect, useState } from 'react';
import cx from '../../components/ui/cx';

/**
 * Skeleton renders a shimmering loading placeholder in place of content that
 * hasn't arrived yet. It intentionally renders nothing for the first `delay`
 * milliseconds so brief loads never flash a placeholder — use it around any
 * async content (table rows, cards, detail panels) while a request is in flight.
 *
 * @param {object} props
 * @param {'text'|'block'|'row'} [props.shape] - Placeholder shape: 'text' for a line of copy, 'block' for a rectangular area (image/card), 'row' for a table-row-shaped set of column segments. Defaults to 'text'.
 * @param {string} [props.width] - CSS width value applied to the placeholder (e.g. '100%', '12rem'). Falls back to a shape-appropriate default.
 * @param {string} [props.height] - CSS height value applied to the placeholder. Falls back to a shape-appropriate default.
 * @param {number} [props.count] - Number of repeated placeholder lines to render. Defaults to 1.
 * @param {number} [props.delay] - Milliseconds to wait before rendering anything, avoiding a flash on fast loads. Defaults to 300.
 * @param {string} [props.className] - Additional classes applied to the outer container.
 */
function Skeleton({ shape = 'text', width, height, count = 1, delay = 300, className }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) {
    return null;
  }

  const lineCount = Math.max(1, count);
  const items = Array.from({ length: lineCount }, (_, i) => i);

  return (
    <div className={cx('flex flex-col gap-2', className)} role="status" aria-label="Loading">
      {items.map((i) => {
        if (shape === 'row') {
          return (
            <div
              key={i}
              className="flex items-center gap-4"
              style={{ width: width ?? '100%', height: height ?? '2.5rem' }}
            >
              <div className="h-4 w-1/12 flex-shrink-0 animate-pulse rounded-ds-sm bg-ds-sunken" />
              <div className="h-4 flex-1 animate-pulse rounded-ds-sm bg-ds-sunken" />
              <div className="h-4 flex-1 animate-pulse rounded-ds-sm bg-ds-sunken" />
              <div className="h-4 w-1/6 flex-shrink-0 animate-pulse rounded-ds-sm bg-ds-sunken" />
            </div>
          );
        }

        if (shape === 'block') {
          return (
            <div
              key={i}
              className="animate-pulse rounded-ds-md bg-ds-sunken"
              style={{ width: width ?? '100%', height: height ?? '5rem' }}
            />
          );
        }

        const isTrailingLine = i === items.length - 1 && items.length > 1;
        return (
          <div
            key={i}
            className="animate-pulse rounded-ds-sm bg-ds-sunken"
            style={{
              width: width ?? (isTrailingLine ? '75%' : '100%'),
              height: height ?? '0.875rem',
            }}
          />
        );
      })}
    </div>
  );
}

export default Skeleton;
