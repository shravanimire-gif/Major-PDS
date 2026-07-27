// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { forwardRef, useId } from 'react';
import cx from '../../components/ui/cx';

/**
 * Single-line text field for forms (names, emails, search terms, numeric
 * values, etc). Renders a label above the input and, below it, either an
 * error message (when `error` is set) or `helperText`. Use whenever a
 * native `<input>` is the right control — for long-form free text use
 * Textarea instead.
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text rendered above the input.
 * @param {string} [props.id] - Id for the input; auto-generated via React.useId if omitted.
 * @param {string} [props.helperText] - Helper text rendered below the input when there is no error.
 * @param {string} [props.error] - Error message rendered below the input; when set, the input is styled as invalid and this replaces helperText.
 * @param {boolean} [props.required=false] - Marks the field as required and appends a subtle * to the label.
 * @param {string} [props.className] - Additional classes merged onto the <input> element.
 * @param {React.Ref} ref - Forwarded ref to the underlying <input> element.
 */
const Input = forwardRef(function Input(
  { label, id, helperText, error, required = false, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = error || helperText ? `${inputId}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-ds-small font-medium text-ds-text-primary">
          {label}
          {required && <span className="text-ds-text-tertiary"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={descriptionId}
        className={cx(
          'rounded-ds-md border bg-ds-surface px-3 py-2 text-ds-body text-ds-text-primary placeholder:text-ds-text-tertiary',
          'transition-colors duration-ds-fast ease-ds-standard',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface',
          'disabled:bg-ds-sunken disabled:text-ds-text-disabled disabled:cursor-not-allowed',
          error ? 'border-ds-danger' : 'border-ds-default',
          className
        )}
        {...props}
      />
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

export default Input;
