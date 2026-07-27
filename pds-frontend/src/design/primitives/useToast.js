import { createContext, useContext } from 'react';

/**
 * Context carrying the current toast queue and the showToast/dismiss actions.
 * Created here so the ToastProvider (Toast.jsx, which renders the visual
 * stack) and the useToast() hook below always share the same instance.
 */
export const ToastContext = createContext(null);

/**
 * useToast reads the toast queue and actions from the nearest ToastProvider.
 * Call it from any component that needs to surface a transient
 * success/info/warning/danger notification, or inspect/dismiss the current
 * queue. Must be rendered inside a <ToastProvider> (see Toast.jsx) or it
 * throws.
 *
 * @returns {{
 *   toasts: Array<{ id: string, tone: 'success'|'info'|'warning'|'danger', message: string, title?: string }>,
 *   showToast: (toast: { tone?: 'success'|'info'|'warning'|'danger', message: string, title?: string }) => string,
 *   dismiss: (id: string) => void
 * }} The current toast queue plus actions to add or remove toasts.
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default useToast;
