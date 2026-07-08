import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Toast from "./Toast";

const ToastContext = createContext(null);

const DEFAULT_DURATION = { success: 2500, error: 3500, info: 3000 };

// App-level toast host. Wrap the app once (see App.js) and call useToast()
// anywhere below it instead of Alert.alert for non-destructive
// success/error/info messaging.
export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const timerRef = useRef(null);
    const nextId = useRef(0);

    const hide = useCallback(() => {
        clearTimeout(timerRef.current);
        setToast(null);
    }, []);

    const show = useCallback((message, options = {}) => {
        const variant = options.variant || "info";
        const duration = options.duration ?? DEFAULT_DURATION[variant] ?? DEFAULT_DURATION.info;

        clearTimeout(timerRef.current);
        nextId.current += 1;
        setToast({ id: nextId.current, message, variant });
        timerRef.current = setTimeout(() => setToast(null), duration);
    }, []);

    // Stable identity: `show`/`hide` never change, so consumers that put
    // `useToast()`'s return value in a useCallback/useEffect dependency
    // array (e.g. QRScreen's fetchSession) don't get needlessly recreated
    // every time a toast is shown/hidden elsewhere in the tree.
    const value = useMemo(() => ({ show, hide }), [show, hide]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toast toast={toast} onHide={hide} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error("useToast must be called within a ToastProvider");
    }
    return ctx;
}
