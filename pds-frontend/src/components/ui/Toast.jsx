import { useCallback, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, CircleX, Info, X } from 'lucide-react';
import ToastContext from './toastContext';
import cx from './cx';

const STATUS_CLASSES = {
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  info: 'bg-info-bg text-info-text border-info-border',
};

const STATUS_ICONS = {
  success: CircleCheck,
  warning: CircleAlert,
  danger: CircleX,
  info: Info,
};

let idCounter = 0;

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (status, message, { duration = 4000 } = {}) => {
      idCounter += 1;
      const id = idCounter;
      setToasts((prev) => [...prev, { id, status, message }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message, options) => push('success', message, options),
      warning: (message, options) => push('warning', message, options),
      danger: (message, options) => push('danger', message, options),
      info: (message, options) => push('info', message, options),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = STATUS_ICONS[toast.status];
          return (
            <div
              key={toast.id}
              role="status"
              className={cx(
                'flex items-start gap-2 rounded-sm border px-4 py-3 text-sm shadow-[var(--shadow-md)]',
                STATUS_CLASSES[toast.status]
              )}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-sm text-current opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
