import { useEffect, useRef, useState } from 'react';
import { Gauge, WifiOff, RefreshCw } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { resolvedApiBaseUrl } from '../../api/axios';

const TOKEN_KEY = 'pds_token';
const RECONNECT_DELAY_MS = 3000;

// http(s):// -> ws(s):// against the same host the REST API resolves to
// (see api/axios.js's resolveBaseURL — same VITE_API_BASE_URL / localhost:5055
// fallback logic), so this tile talks to the same backend as everything else.
const resolveWsUrl = () => {
    const base = resolvedApiBaseUrl || `${window.location.protocol}//${window.location.hostname}:5055`;
    return `${base.replace(/^http/, 'ws')}/ws/admin/live`;
};

const formatTimestamp = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
};

const LiveWeightTile = ({ shopId }) => {
    const [connected, setConnected] = useState(false);
    const [deviceOnline, setDeviceOnline] = useState(null);
    const [reading, setReading] = useState(null);

    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const unmountedRef = useRef(false);

    useEffect(() => {
        unmountedRef.current = false;

        const connect = () => {
            const token = localStorage.getItem(TOKEN_KEY);
            const ws = new WebSocket(resolveWsUrl(), token ? [token] : undefined);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                ws.send(JSON.stringify({ type: 'subscribe', shopId }));
            };

            ws.onmessage = (event) => {
                let payload;
                try {
                    payload = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (payload.type === 'reading') {
                    setDeviceOnline(true);
                    setReading({ gramsInt: payload.gramsInt, takenAt: payload.takenAt });
                } else if (payload.type === 'device_status') {
                    setDeviceOnline(payload.online);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (!unmountedRef.current) {
                    reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
                }
            };

            ws.onerror = () => {
                ws.close();
            };
        };

        connect();

        return () => {
            unmountedRef.current = true;
            clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [shopId]);

    let statusLabel;
    let statusBadge;
    if (!connected) {
        statusLabel = 'Reconnecting…';
        statusBadge = <Badge status="warning" dot icon={<RefreshCw size={12} className="animate-spin" />}>Reconnecting…</Badge>;
    } else if (deviceOnline === false) {
        statusLabel = 'Device offline';
        statusBadge = <Badge status="danger" dot icon={<WifiOff size={12} />}>Device offline</Badge>;
    } else if (reading) {
        statusLabel = `Reading: ${reading.gramsInt.toLocaleString()} g`;
        statusBadge = <Badge status="success" dot>Live</Badge>;
    } else {
        statusLabel = 'Ready (0 g)';
        statusBadge = <Badge status="neutral" dot>Ready</Badge>;
    }

    return (
        <Card
            header={
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Gauge size={18} />
                        Live Weight
                    </span>
                    {statusBadge}
                </div>
            }
        >
            <p className="text-2xl font-bold tabular-nums text-text-primary">{statusLabel}</p>
            {reading?.takenAt && (
                <p className="mt-1 text-xs text-text-secondary">Last updated {formatTimestamp(reading.takenAt)}</p>
            )}
        </Card>
    );
};

export default LiveWeightTile;
