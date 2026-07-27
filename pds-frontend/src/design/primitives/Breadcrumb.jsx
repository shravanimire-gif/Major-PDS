// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { ChevronRight } from 'lucide-react';
import cx from '../../components/ui/cx';

/**
 * Chevron-separated path indicator for showing the current page's location
 * within a hierarchy. Use near the top of a page, above its title. The last
 * item always renders as plain text (the current page), even if it has an
 * href — earlier items render as links.
 *
 * @param {Object} props
 * @param {Array<{ label: string, href?: string }>} props.items - Breadcrumb trail, in order from root to current page.
 * @param {(item: { label: string, href?: string }, index: number) => React.ReactNode} [props.renderLink] - Optional custom renderer for non-current items (e.g. to render react-router's `Link` instead of a plain `<a>`). Receives the item and its index and must return the link element.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function Breadcrumb({ items, renderLink, className, ...props }) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={cx(className)} {...props}>
      <ol className="flex items-center gap-1.5 text-ds-small text-ds-text-tertiary">
        {items.map((item, index) => {
          const isCurrent = index === lastIndex;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight size={12} className="text-ds-text-tertiary" aria-hidden="true" />
              ) : null}
              {isCurrent ? (
                <span aria-current="page" className="text-ds-text-tertiary">
                  {item.label}
                </span>
              ) : renderLink ? (
                renderLink(item, index)
              ) : (
                <a
                  href={item.href}
                  className={cx(
                    'text-ds-text-tertiary hover:text-ds-text-primary transition-colors duration-ds-fast ease-ds-standard',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface rounded-ds-sm'
                  )}
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
