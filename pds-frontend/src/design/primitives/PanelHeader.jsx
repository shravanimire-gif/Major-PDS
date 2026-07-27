// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import cx from '../../components/ui/cx';

/**
 * Header block for a Card/panel: a title, optional subtitle, and an
 * optional right-aligned actions slot, separated from the panel body by
 * a bottom rule. Use at the top of dashboard panels and content sections.
 *
 * @param {Object} props
 * @param {string} props.title - Panel title text.
 * @param {string} [props.subtitle] - Optional supporting text rendered below the title.
 * @param {React.ReactNode} [props.actions] - Optional right-aligned slot for buttons or controls.
 * @param {string} [props.className] - Additional classes merged onto the root element.
 */
function PanelHeader({ title, subtitle, actions, className, ...props }) {
  return (
    <div
      className={cx('flex items-start justify-between border-b border-ds-subtle pb-4 mb-4', className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-ds-title font-semibold text-ds-text-primary">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-ds-body text-ds-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-shrink-0">{actions}</div> : null}
    </div>
  );
}

export default PanelHeader;
