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
  sm: 'p-1.5',
  md: 'p-2',
};

const SPINNER_SIZE_CLASSES = {
  sm: 'size-3.5',
  md: 'size-4',
};

/**
 * Square, icon-only button for compact toolbar/action-row use (close,
 * edit, delete, overflow menu triggers) where a text label would be too
 * heavy. Because there is no visible label, `ariaLabel` is REQUIRED —
 * omitting it (or passing an empty string) makes the button unreadable
 * to screen reader users and is a misuse of this component.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.icon - The icon to render, centered in the button.
 * @param {string} props.ariaLabel - Required accessible label describing the action; passed through as the button's aria-label.
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant='primary'] - Visual style signaling the action's importance.
 * @param {'sm'|'md'} [props.size='md'] - Button size, controls padding.
 * @param {boolean} [props.disabled=false] - Disables the button.
 * @param {boolean} [props.loading=false] - Shows a spinner in place of the icon and disables the button while an action is in flight.
 * @param {React.Ref} ref - Forwarded ref to the underlying <button> element.
 */
const IconButton = forwardRef(function IconButton(
  {
    icon,
    ariaLabel,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
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
      aria-label={ariaLabel}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={cx(
        'inline-flex items-center justify-center rounded-ds-md',
        'transition-colors duration-ds-fast ease-ds-standard',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {loading ? (
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
      ) : (
        icon
      )}
    </button>
  );
});

export default IconButton;
