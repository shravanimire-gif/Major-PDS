import { forwardRef } from 'react';
import cx from './cx';

const VARIANT_CLASSES = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600',
  secondary: 'bg-surface border border-border text-text-primary hover:bg-surface-muted',
  ghost: 'bg-transparent text-text-primary hover:bg-surface-muted',
  danger: 'bg-danger-text text-white hover:opacity-90',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

const Button = forwardRef(
  ({ variant = 'primary', size = 'md', className, type = 'button', disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center rounded-sm font-medium transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = 'Button';

export default Button;
