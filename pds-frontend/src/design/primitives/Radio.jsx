// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { forwardRef, useId } from 'react';
import cx from '../../components/ui/cx';

/**
 * A single option within a mutually-exclusive group (e.g. one choice among
 * several settings). Always renders paired with a visible text label and is
 * meant to be used alongside sibling Radios sharing the same `name` — the
 * browser/OS handles the roving selection via native radio semantics.
 *
 * @param {Object} props
 * @param {string} props.label - Visible text label rendered next to the radio (required).
 * @param {string} [props.id] - Id applied to the input and referenced by the label's htmlFor. Auto-generated via React.useId if omitted.
 * @param {string} [props.name] - Name shared by every Radio in the same mutually-exclusive group.
 * @param {string} [props.value] - Value submitted/reported for this option.
 * @param {boolean} [props.checked] - Whether this radio is the selected option.
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange] - Change handler.
 * @param {boolean} [props.disabled] - Disables the control and dims the whole label.
 * @param {string} [props.className] - Additional classes merged onto the outer <label>.
 * @param {React.Ref} ref - Forwarded ref to the underlying <input type="radio">.
 */
const Radio = forwardRef(function Radio(
  { label, id, name, value, checked, onChange, disabled, className, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      className={cx(
        'inline-flex items-center gap-2 text-ds-body text-ds-text-primary',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className
      )}
    >
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={inputId}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer absolute inset-0 h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none flex h-4 w-4 items-center justify-center rounded-full border bg-ds-surface transition-colors duration-ds-fast ease-ds-standard',
            checked ? 'border-ds-accent' : 'border-ds-default',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ds-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ds-surface'
          )}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-ds-accent" />}
        </span>
      </span>
      {label}
    </label>
  );
});

export default Radio;
