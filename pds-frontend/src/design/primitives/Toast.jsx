// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';
import cx from '../../components/ui/cx';
import { ToastContext, useToast } from './useToast';

const AUTO_DISMISS_MS = 5000;
const STICKY_TONES = new Set(['warning', 'danger']);

const TONE_CONFIG = {
  success: { Icon: CheckCircle2, tone: 'text-ds-success', border: 'border-ds-success', role: 'status' },
  info: { Icon: Info, tone: 'text-ds-info', border: 'border-ds-info', role: 'status' },
  warning: { Icon: AlertTriangle, tone: 'text-ds-warning', border: 'border-ds-warning', role: 'alert' },
  danger: { Icon: AlertCircle, tone: 'text-ds-danger', border: 'border-ds-danger', role: 'alert' },
};

let idCounter = 0;
function nextToastId() {
  idCounter += 1;
  return `toast-${idCounter}`;
}

/**
 * ToastProvider supplies the toast queue and actions (via useToast()) to its
 * subtree and renders the fixed bottom-right toast stack. Mount it once near
 * the root of the app so any descendant can call showToast() to surface a
 * transient success/info/warning/danger notification.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - App content rendered inside the provider.
 */
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ tone = 'info', message, title }) => {
      const id = nextToastId();
      setToasts((current) => [...current, { id, tone, message, title }]);

      if (!STICKY_TONES.has(tone)) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, AUTO_DISMISS_MS);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col-reverse gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * ToastCard renders a single toast's visual card. Internal to Toast.jsx — not
 * exported, since ToastProvider is the only place toasts should be rendered
 * from (call useToast().showToast() to create one instead of rendering this
 * directly).
 *
 * @param {object} props
 * @param {{ id: string, tone: 'success'|'info'|'warning'|'danger', message: string, title?: string }} props.toast - The toast data to render.
 * @param {(id: string) => void} props.onDismiss - Called with the toast id when the user dismisses it.
 */
function ToastCard({ toast, onDismiss }) {
  const config = TONE_CONFIG[toast.tone] ?? TONE_CONFIG.info;
  const { Icon, tone, border, role } = config;

  return (
    <div
      role={role}
      className={cx(
        'flex items-start gap-3 rounded-ds-lg border bg-ds-surface p-4 shadow-ds-md',
        border
      )}
    >
      <Icon className={cx('mt-0.5 h-5 w-5 flex-shrink-0', tone)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title ? (
          <p className="text-ds-body font-semibold text-ds-text-primary">{toast.title}</p>
        ) : null}
        <p className="text-ds-body text-ds-text-secondary">{toast.message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 rounded-ds-sm p-1 text-ds-text-tertiary transition-colors duration-ds-fast ease-ds-standard hover:text-ds-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- re-exporting the hook here is intentional so callers can `import { useToast } from '.../Toast'` in addition to '.../useToast'
export { useToast };
export default ToastProvider;
