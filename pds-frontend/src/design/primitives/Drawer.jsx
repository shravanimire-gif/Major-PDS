// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import cx from '../../components/ui/cx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side panel that slides in from the right for contextual detail views that
 * don't need to fully interrupt the page — e.g. inspecting a record's raw
 * JSON alongside a list. Use it instead of Dialog when the content is
 * reference material the user may want to compare against what's still
 * visible behind it; use Dialog instead when the user must resolve a focused
 * task (a confirmation, a short form) before continuing.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the drawer is visible. Renders nothing when false.
 * @param {() => void} props.onClose - Required. Called when the user dismisses the drawer via the overlay, the close button, or the Escape key.
 * @param {string} [props.title] - Drawer title, rendered in the header and referenced by aria-labelledby.
 * @param {React.ReactNode} [props.children] - Scrollable body content of the drawer.
 * @param {React.ReactNode} [props.footer] - Optional right-aligned footer actions area; the footer region only renders when this is passed.
 */
function Drawer({ open, onClose, title, children, footer }) {
  const drawerRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();

  // Move focus into the drawer when it opens, and return it to whatever had
  // focus beforehand once it closes.
  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement;

      const focusables = drawerRef.current
        ? drawerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
        : null;

      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      } else if (drawerRef.current) {
        drawerRef.current.focus();
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

    const focusables = drawerRef.current
      ? Array.from(drawerRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
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
    <div className="fixed inset-0 z-50 bg-ds-overlay/40" onClick={onClose}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={cx(
          'fixed inset-y-0 right-0 flex h-full w-full max-w-md flex-col bg-ds-surface shadow-ds-md',
          'transition-transform duration-ds-slow ease-ds-standard',
          open ? 'translate-x-0' : 'translate-x-full',
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

        <div className="flex-1 overflow-y-auto px-4 py-4 text-ds-body text-ds-text-primary">
          {children}
        </div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-ds-subtle px-4 pt-4 pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Drawer;
