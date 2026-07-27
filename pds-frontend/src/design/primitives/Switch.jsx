// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { forwardRef, useId } from 'react';
import cx from '../../components/ui/cx';

/**
 * A toggle for a single, immediately-applied on/off setting (e.g. "Enable
 * email notifications"). Use it only for genuine settings that take effect
 * right away — never as a stand-in for a form-submission action; reach for
 * Button when the control needs to be explicitly submitted/confirmed.
 *
 * @param {Object} props
 * @param {string} [props.label] - Optional visible text label rendered next to the switch; when provided it is wired to the switch via label/htmlFor and aria-labelledby (so it doubles as the accessible name).
 * @param {boolean} [props.checked] - Whether the switch is on.
 * @param {(checked: boolean) => void} [props.onChange] - Called with the next boolean value whenever the switch is toggled.
 * @param {boolean} [props.disabled] - Disables the control and dims it.
 * @param {string} [props.id] - Id applied to the switch button; auto-generated via React.useId if omitted.
 * @param {string} [props.className] - Additional classes merged onto the outer wrapper.
 * @param {React.Ref} ref - Forwarded ref to the underlying <button role="switch">.
 */
const Switch = forwardRef(function Switch(
  { label, checked = false, onChange, disabled, id, className, ...props },
  ref
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const labelId = label ? `${switchId}-label` : undefined;

  const toggle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };

  return (
    <span className={cx('inline-flex items-center gap-2', disabled && 'cursor-not-allowed opacity-60', className)}>
      <button
        ref={ref}
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={toggle}
        className={cx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-ds-lg transition-colors duration-ds-fast ease-ds-standard',
          checked ? 'bg-ds-accent' : 'bg-ds-border-default',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cx(
            'inline-block h-3.5 w-3.5 rounded-ds-sm bg-ds-surface transition-transform duration-ds-fast ease-ds-standard',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
      {label && (
        <label
          id={labelId}
          htmlFor={switchId}
          className={cx('text-ds-body text-ds-text-primary', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        >
          {label}
        </label>
      )}
    </span>
  );
});

export default Switch;
