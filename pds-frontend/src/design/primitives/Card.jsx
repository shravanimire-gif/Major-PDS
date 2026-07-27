// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import cx from '../../components/ui/cx';

/**
 * Generic panel/card container for grouping related content. Use as the
 * outer wrapper for dashboard tiles, list panels, and content sections.
 * Borders only — never apply a shadow to this component.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function Card({ children, className, ...props }) {
  return (
    <div
      className={cx('bg-ds-surface border border-ds-subtle rounded-ds-lg p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
