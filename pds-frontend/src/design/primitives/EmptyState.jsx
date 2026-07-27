// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import cx from '../../components/ui/cx';

/**
 * EmptyState renders the "nothing here yet" placeholder for list/table pages.
 * Use it instead of ever showing an empty table with just headers — swap it
 * in wherever a data fetch resolves to zero rows (empty search results, an
 * unconfigured feature, a freshly-created workspace with no records yet).
 *
 * @param {object} props
 * @param {React.ReactNode} [props.icon] - Decorative icon element (e.g. a lucide-react icon) shown above the title.
 * @param {string} props.title - Required short headline describing the empty condition.
 * @param {string} [props.description] - Optional supporting copy with more context or next steps.
 * @param {React.ReactNode} [props.action] - Optional call-to-action element (typically a Button) rendered below the description.
 * @param {string} [props.className] - Additional classes applied to the outer container.
 */
function EmptyState({ icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mb-4 text-ds-text-tertiary" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className="text-ds-subtitle font-semibold text-ds-text-primary">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-ds-body text-ds-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
