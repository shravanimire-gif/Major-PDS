import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { resolvedApiBaseUrl } from '../../api/axios';
import api from '../../api/axios';
import ShopTimestamp from '../ui/ShopTimestamp';

const TOKEN_KEY = 'pds_token';
const RECONNECT_DELAY_MS = 3000;

// Same WS connect/reconnect pattern as LiveWeightTile.jsx, but this widget
// is mounted once in AdminTopBar (persists across every /admin/* page, see
// AdminLayout) rather than page-scoped, and never sends a `subscribe`
// message — the backend pushes anomaly_summary to every connected admin
// unconditionally (it's dashboard-wide, no shop scoping).
const resolveWsUrl = () => {
    const base = resolvedApiBaseUrl || `${window.location.protocol}//${window.location.hostname}:5055`;
    return `${base.replace(/^http/, 'ws')}/ws/admin/live`;
};

const AnomalyBadge = () => {
    const [unresolvedCritical, setUnresolvedCritical] = useState(0);
    const [open, setOpen] = useState(false);
    const [flags, setFlags] = useState([]);
    const [loadingFlags, setLoadingFlags] = useState(false);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const unmountedRef = useRef(false);
    const menuRef = useRef(null);

    useEffect(() => {
        unmountedRef.current = false;

        const connect = () => {
            const token = localStorage.getItem(TOKEN_KEY);
            const ws = new WebSocket(resolveWsUrl(), token ? [token] : undefined);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                let payload;
                try {
                    payload = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (payload.type === 'anomaly_summary') {
                    setUnresolvedCritical(payload.unresolvedCritical);
                }
            };

            ws.onclose = () => {
                if (!unmountedRef.current) {
                    reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
                }
            };

            ws.onerror = () => ws.close();
        };

        connect();

        return () => {
            unmountedRef.current = true;
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, []);

    useEffect(() => {
        if (!open) return undefined;

        const handleClickAway = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickAway);
        return () => document.removeEventListener('mousedown', handleClickAway);
    }, [open]);

    const handleToggle = async () => {
        const next = !open;
        setOpen(next);
        if (next) {
            setLoadingFlags(true);
            try {
                const res = await api.get('/api/admin/anomalies', { params: { severity: 'critical', resolved: 'false' } });
                setFlags(res.data.flags.slice(0, 5));
            } catch {
                setFlags([]);
            } finally {
                setLoadingFlags(false);
            }
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={handleToggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Unresolved critical anomalies"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-muted hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
                <AlertTriangle size={20} />
                {unresolvedCritical > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger-text px-1 text-[10px] font-semibold text-white">
                        {unresolvedCritical}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-md)]"
                >
                    <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
                        Unresolved critical anomalies
                    </p>
                    {loadingFlags && <p className="px-2 py-3 text-sm text-text-secondary">Loading…</p>}
                    {!loadingFlags && flags.length === 0 && (
                        <p className="px-2 py-3 text-sm text-text-secondary">None right now.</p>
                    )}
                    {!loadingFlags &&
                        flags.map((flag) => (
                            <div key={flag.id} className="rounded-sm px-2 py-2 text-sm hover:bg-surface-muted">
                                <p className="font-medium text-text-primary">
                                    {flag.rule_key} — {flag.shop_name}
                                </p>
                                <p className="text-xs text-text-secondary">{flag.description}</p>
                                <ShopTimestamp value={flag.created_at} className="text-xs text-text-disabled" />
                            </div>
                        ))}
                    <div className="mt-1 border-t border-border pt-1">
                        <Link
                            to="/admin/anomalies"
                            className="block rounded-sm px-2 py-2 text-center text-sm font-medium text-brand-500 hover:bg-surface-muted"
                            onClick={() => setOpen(false)}
                        >
                            View all
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnomalyBadge;
