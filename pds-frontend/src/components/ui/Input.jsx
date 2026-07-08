import { forwardRef, useId } from 'react';
import cx from './cx';

// error accepts either a plain string or react-hook-form's FieldError ({ message }).
const resolveErrorMessage = (error) => (typeof error === 'string' ? error : error?.message);

const Input = forwardRef(({ label, id, required, error, hint, className, inputClassName, ...props }, ref) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorMessage = resolveErrorMessage(error);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-text-primary">
          {label}
          {required && <span className="ml-0.5 text-danger-text">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={errorMessage ? 'true' : undefined}
        aria-describedby={errorMessage ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cx(
          'w-full rounded-sm border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled transition',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          errorMessage ? 'border-danger-border' : 'border-border focus:border-brand-500',
          inputClassName
        )}
        {...props}
      />
      {errorMessage ? (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-danger-text">
          {errorMessage}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-text-secondary">
            {hint}
          </p>
        )
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
