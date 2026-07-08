import { forwardRef, useId } from 'react';
import cx from './cx';

const resolveErrorMessage = (error) => (typeof error === 'string' ? error : error?.message);

const Select = forwardRef(({ label, id, required, error, hint, className, children, ...props }, ref) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorMessage = resolveErrorMessage(error);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-text-primary">
          {label}
          {required && <span className="ml-0.5 text-danger-text">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={errorMessage ? 'true' : undefined}
        aria-describedby={errorMessage ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        className={cx(
          'w-full rounded-sm border bg-surface px-3 py-2 text-sm text-text-primary transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          errorMessage ? 'border-danger-border' : 'border-border focus:border-brand-500'
        )}
        {...props}
      >
        {children}
      </select>
      {errorMessage ? (
        <p id={`${selectId}-error`} className="mt-1 text-xs text-danger-text">
          {errorMessage}
        </p>
      ) : (
        hint && (
          <p id={`${selectId}-hint`} className="mt-1 text-xs text-text-secondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
