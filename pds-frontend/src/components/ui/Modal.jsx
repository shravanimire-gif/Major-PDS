import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import cx from './cx';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal = ({ isOpen, onClose, title, children, footer, className }) => {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();

  // "Latest ref" for onClose so the focus-trap effect below can depend on
  // `isOpen` ALONE.
  //
  // Callers pass an inline arrow (`onClose={() => setOpen(false)}`), which is a
  // new function identity on every render — so with `onClose` in the dependency
  // array the effect tore down and re-ran on every render of the parent. Its
  // cleanup restores focus to whatever was focused before, and its body then
  // focuses the panel's first focusable element, so a controlled input inside a
  // modal lost focus after the FIRST character typed: every keystroke changed
  // parent state, which re-ran the trap, which moved focus to the panel's first
  // control. Typing "ESP32-A1B2C3" registered as "E".
  //
  // The ref keeps Escape wired to the current callback while making the effect
  // run exactly twice per modal — on open and on close — which is the only time
  // focus should move.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusables = panel ? Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) : [];
    (focusables[0] || panel)?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const currentFocusables = panel ? Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) : [];
      if (currentFocusables.length === 0) return;

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-[var(--shadow-lg)] focus:outline-none',
          className
        )}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={titleId} className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-sm p-1 text-text-secondary transition hover:bg-surface-muted hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
