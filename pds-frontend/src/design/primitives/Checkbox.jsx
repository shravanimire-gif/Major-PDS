// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { forwardRef, useId } from 'react';
import { Check } from 'lucide-react';
import cx from '../../components/ui/cx';

/**
 * A single binary or multi-select option inside forms, filters, and lists.
 * Always renders paired with a visible text label — use it whenever the
 * choice needs an explicit on/off checkbox affordance rather than a Switch
 * (which is reserved for settings that take effect immediately).
 *
 * @param {Object} props
 * @param {string} props.label - Visible text label rendered next to the checkbox (required).
 * @param {string} [props.id] - Id applied to the input and referenced by the label's htmlFor. Auto-generated via React.useId if omitted.
 * @param {boolean} [props.checked] - Whether the checkbox is checked.
 * @param {(event: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange] - Change handler.
 * @param {boolean} [props.disabled] - Disables the control and dims the whole label.
 * @param {string} [props.className] - Additional classes merged onto the outer <label>.
 * @param {React.Ref} ref - Forwarded ref to the underlying <input type="checkbox">.
 */
const Checkbox = forwardRef(function Checkbox(
  { label, id, checked, onChange, disabled, className, ...props },
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
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer absolute inset-0 h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none flex h-4 w-4 items-center justify-center rounded-ds-sm border transition-colors duration-ds-fast ease-ds-standard',
            checked ? 'border-ds-accent bg-ds-accent' : 'border-ds-default bg-ds-surface',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ds-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ds-surface'
          )}
        >
          {checked && <Check className="h-3 w-3 text-ds-text-inverse" strokeWidth={3} />}
        </span>
      </span>
      {label}
    </label>
  );
});

export default Checkbox;
