// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { forwardRef, useId } from 'react';
import cx from '../../components/ui/cx';

/**
 * Multi-line text field for forms (descriptions, notes, comments), with
 * the same label / helper text / error treatment as Input. Use whenever
 * free text may span multiple lines — for single-line values use Input
 * instead.
 *
 * @param {Object} props
 * @param {string} [props.label] - Label text rendered above the textarea.
 * @param {string} [props.id] - Id for the textarea; auto-generated via React.useId if omitted.
 * @param {string} [props.helperText] - Helper text rendered below the textarea when there is no error.
 * @param {string} [props.error] - Error message rendered below the textarea; when set, the textarea is styled as invalid and this replaces helperText.
 * @param {boolean} [props.required=false] - Marks the field as required and appends a subtle * to the label.
 * @param {number} [props.rows=3] - Number of visible text rows.
 * @param {string} [props.className] - Additional classes merged onto the <textarea> element.
 * @param {React.Ref} ref - Forwarded ref to the underlying <textarea> element.
 */
const Textarea = forwardRef(function Textarea(
  { label, id, helperText, error, required = false, rows = 3, className, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const descriptionId = error || helperText ? `${textareaId}-description` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-ds-small font-medium text-ds-text-primary">
          {label}
          {required && <span className="text-ds-text-tertiary"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
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

export default Textarea;
