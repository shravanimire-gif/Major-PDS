// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import cx from '../../components/ui/cx';

/**
 * Native single-select dropdown for forms, with the same label / helper
 * text / error treatment as Input. Pass `options` as an array of
 * `{ value, label }` pairs, or pass `<option>` elements directly as
 * children when more control is needed (e.g. option groups, disabled
 * options). Use for choosing one value from a short, known list.
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text rendered above the select.
 * @param {string} [props.id] - Id for the select; auto-generated via React.useId if omitted.
 * @param {string} [props.helperText] - Helper text rendered below the select when there is no error.
 * @param {string} [props.error] - Error message rendered below the select; when set, the select is styled as invalid and this replaces helperText.
 * @param {boolean} [props.required=false] - Marks the field as required and appends a subtle * to the label.
 * @param {Array<{value: string, label: string}>} [props.options] - Options to render as <option> elements; ignored when children are passed.
 * @param {React.ReactNode} [props.children] - <option> elements rendered instead of `options`.
 * @param {string} [props.className] - Additional classes merged onto the <select> element.
 * @param {React.Ref} ref - Forwarded ref to the underlying <select> element.
 */
const Select = forwardRef(function Select(
  { label, id, helperText, error, required = false, options, children, className, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = error || helperText ? `${selectId}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-ds-small font-medium text-ds-text-primary">
          {label}
          {required && <span className="text-ds-text-tertiary"> *</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptionId}
          className={cx(
            'w-full appearance-none rounded-ds-md border bg-ds-surface px-3 py-2 pr-9 text-ds-body text-ds-text-primary',
            'transition-colors duration-ds-fast ease-ds-standard',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface',
            'disabled:bg-ds-sunken disabled:text-ds-text-disabled disabled:cursor-not-allowed',
            error ? 'border-ds-danger' : 'border-ds-default',
            className
          )}
          {...props}
        >
          {children ??
            options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ds-text-tertiary"
        />
      </div>
      {error ? (
        <p id={descriptionId} className="text-ds-small text-ds-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={descriptionId} className="text-ds-small text-ds-text-tertiary">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Select;
