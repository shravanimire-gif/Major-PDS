// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { forwardRef } from 'react';
import cx from '../../components/ui/cx';

const VARIANT_CLASSES = {
  primary: 'bg-ds-accent text-ds-text-inverse hover:bg-ds-accent-hover active:bg-ds-accent-active',
  secondary:
    'bg-ds-surface border border-ds-default text-ds-text-primary hover:bg-ds-surface-alt',
  ghost: 'bg-transparent text-ds-text-primary hover:bg-ds-surface-alt',
  danger: 'bg-ds-danger text-ds-text-inverse hover:opacity-90',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-ds-small',
  md: 'px-4 py-2 text-ds-body',
};

const SPINNER_SIZE_CLASSES = {
  sm: 'size-3.5',
  md: 'size-4',
};

/**
 * Primary button primitive for triggering actions (submitting forms,
 * confirming dialogs, navigating). Use `variant` to signal importance
 * (primary for the main call-to-action, secondary/ghost for lesser
 * actions, danger for destructive ones), and `loading` to communicate
 * an in-flight async action while keeping the label visible.
 *
 * @param {Object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant='primary'] - Visual style signaling the action's importance.
 * @param {'sm'|'md'} [props.size='md'] - Button size, controls padding and text size.
 * @param {React.ReactNode} [props.iconLeft] - Icon rendered before the label.
 * @param {React.ReactNode} [props.iconRight] - Icon rendered after the label.
 * @param {boolean} [props.loading=false] - Shows a spinner and disables the button while an action is in flight.
 * @param {boolean} [props.disabled=false] - Disables the button.
 * @param {React.ReactNode} [props.children] - Button label content.
 * @param {React.Ref} ref - Forwarded ref to the underlying <button> element.
 */
const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconLeft,
    iconRight,
    loading = false,
    disabled = false,
    children,
    className,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-ds-md font-medium',
        'transition-colors duration-ds-fast ease-ds-standard',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading && (
        <span
          className={cx(
            /* rounded-ds-lg (8px) clamps to a full circle on these small,
               square sizes (max half-dimension is 8px) — see tokens.css
               radius note; this is not a rounded-full violation. */
            'inline-block animate-spin rounded-ds-lg border-2 border-current border-t-transparent',
            SPINNER_SIZE_CLASSES[size]
          )}
          aria-hidden="true"
        />
      )}
      {!loading && iconLeft}
      {children && <span className={loading ? 'opacity-60' : undefined}>{children}</span>}
      {!loading && iconRight}
    </button>
  );
});

export default Button;
