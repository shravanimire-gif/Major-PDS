// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import cx from '../../components/ui/cx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog for focused tasks that interrupt the current flow — confirmations,
 * short forms, detail editors. Use it whenever the user must respond to or
 * dismiss the content before continuing with the rest of the page; for a
 * non-blocking contextual hint use Tooltip instead.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is visible. Renders nothing when false.
 * @param {() => void} props.onClose - Required. Called when the user dismisses the dialog via the overlay, the close button, or the Escape key.
 * @param {string} [props.title] - Dialog title, rendered in the header and referenced by aria-labelledby.
 * @param {React.ReactNode} [props.children] - Body content of the dialog.
 * @param {React.ReactNode} [props.footer] - Optional right-aligned footer actions area; the footer region only renders when this is passed.
 */
function Dialog({ open, onClose, title, children, footer }) {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();

  // Move focus into the dialog when it opens, and return it to whatever had
  // focus beforehand once it closes.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;

      const focusables = dialogRef.current
        ? dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        : null;

      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    } else if (previouslyFocusedRef.current instanceof HTMLElement) {
      previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusables = dialogRef.current
      ? Array.from(dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
      : [];

    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay/40" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={cx(
          'w-full max-w-md rounded-ds-lg bg-ds-surface shadow-ds-md',
          'focus:outline-none'
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ds-subtle px-4 py-3">
          {title ? (
            <h2 id={titleId} className="text-ds-title font-semibold text-ds-text-primary">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={cx(
              'shrink-0 rounded-ds-sm p-1 text-ds-text-tertiary',
              'transition-colors duration-ds-fast ease-ds-standard hover:text-ds-text-primary',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-4 text-ds-body text-ds-text-primary">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-ds-subtle px-4 pt-4 pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Dialog;
