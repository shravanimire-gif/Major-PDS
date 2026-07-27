// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { useId, useState } from 'react';
import cx from '../../components/ui/cx';

/**
 * Underline-style tab navigation for switching between related content
 * panels within a single view (e.g. device detail sections). Manages its
 * own active-tab state internally — no external state manager required.
 * Not for primary page-level navigation; use for in-page content switching.
 *
 * @param {Object} props
 * @param {Array<{ key: string, label: string, content: React.ReactNode }>} props.items - Tabs to render, in order.
 * @param {string} [props.defaultActiveKey] - Key of the initially active tab. Defaults to items[0].key.
 * @param {(key: string) => void} [props.onChange] - Called with the new active key whenever the active tab changes.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function Tabs({ items, defaultActiveKey, onChange, className, ...props }) {
  const [activeKey, setActiveKey] = useState(defaultActiveKey ?? items[0]?.key);
  const baseId = useId();

  const activeIndex = Math.max(0, items.findIndex((item) => item.key === activeKey));

  const activate = (key) => {
    setActiveKey(key);
    if (onChange) onChange(key);
  };

  const handleKeyDown = (event) => {
    const isNext = event.key === 'ArrowRight';
    const isPrev = event.key === 'ArrowLeft';

    if (isNext || isPrev) {
      event.preventDefault();
      const delta = isNext ? 1 : -1;
      const nextIndex = (activeIndex + delta + items.length) % items.length;
      const nextItem = items[nextIndex];
      activate(nextItem.key);
      const nextTab = document.getElementById(`${baseId}-tab-${nextItem.key}`);
      if (nextTab) nextTab.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(event.target.dataset.key);
    }
  };

  const activeItem = items[activeIndex];

  return (
    <div className={cx(className)} {...props}>
      <div role="tablist" aria-label="Tabs" className="flex items-center gap-6 border-b border-ds-subtle">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              id={`${baseId}-tab-${item.key}`}
              data-key={item.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${item.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => activate(item.key)}
              onKeyDown={handleKeyDown}
              className={cx(
                '-mb-px px-1 py-2 text-ds-body transition-colors duration-ds-fast ease-ds-standard',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface',
                isActive
                  ? 'border-b-2 border-ds-accent text-ds-text-primary font-medium'
                  : 'border-b-2 border-transparent text-ds-text-secondary hover:text-ds-text-primary'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem ? (
        <div
          id={`${baseId}-panel-${activeItem.key}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeItem.key}`}
          tabIndex={0}
          className="pt-4"
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}

export default Tabs;
