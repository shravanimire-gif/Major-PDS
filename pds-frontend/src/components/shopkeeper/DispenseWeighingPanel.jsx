import { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import api, { resolvedApiBaseUrl } from '../../api/axios';

const TOKEN_KEY = 'pds_token';
const RECONNECT_DELAY_MS = 3000;

const TERMINAL_STATES = ['committed', 'cancelled', 'device_lost', 'failed_insufficient_balance'];

const resolveWsUrl = () => {
    const base = resolvedApiBaseUrl || `${window.location.protocol}//${window.location.hostname}:5055`;
    return `${base.replace(/^http/, 'ws')}/ws/shopkeeper/live`;
};

const COMMODITY_LABEL = { rice: 'rice', wheat: 'wheat', sugar: 'sugar' };

// The IoT-gated dispense screen from Phase 2: beneficiary card on top, a big
// live weight readout with a tolerance band in the middle, Cancel always
// available at the bottom. Never shows a modal while weighing — only for
// terminal outcomes (confirmed / cancelled / failed), per spec.
const DispenseWeighingPanel = ({
    sessionId,
    commodity,
    entitledGrams,
    toleranceGrams,
    beneficiaryName,
    cardNumber,
    onDone,
}) => {
    const [connected, setConnected] = useState(false);
    const [sessionState, setSessionState] = useState('attached');
    const [gramsInt, setGramsInt] = useState(0);
    const [msLeft, setMsLeft] = useState(null);
    const [cancelling, setCancelling] = useState(false);

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
                ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
            };

            ws.onmessage = (event) => {
                let payload;
                try {
                    payload = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (payload.type === 'reading') {
                    setGramsInt(payload.gramsInt);
                } else if (payload.type === 'state') {
                    setSessionState(payload.state);
                    if (payload.state === 'confirming' && typeof payload.msLeft === 'number') {
                        setMsLeft(payload.msLeft);
                    } else if (payload.state !== 'confirming') {
                        setMsLeft(null);
                    }
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (!unmountedRef.current && !TERMINAL_STATES.includes(sessionState)) {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    // Local countdown ticker — the server sends msLeft once when 'confirming'
    // starts; this just counts it down for a smooth in-between display.
    // Deliberately keyed on isConfirming (not msLeft itself) — depending on
    // msLeft would tear down and restart the interval on every tick.
    const isConfirming = sessionState === 'confirming' && msLeft !== null;
    useEffect(() => {
        if (!isConfirming) return undefined;

        const interval = setInterval(() => {
            setMsLeft((prev) => (prev === null ? null : Math.max(0, prev - 250)));
        }, 250);

        return () => clearInterval(interval);
    }, [isConfirming]);

    const handleCancel = async () => {
        setCancelling(true);
        try {
            await api.post(`/api/dispense/session/${sessionId}/cancel`);
        } catch {
            // Session may have already reached a terminal state server-side —
            // the WS 'state' event (or its absence) is the source of truth.
        } finally {
            setCancelling(false);
        }
    };

    const diff = gramsInt - entitledGrams;
    const absDiff = Math.abs(diff);
    const commodityLabel = COMMODITY_LABEL[commodity] || commodity;

    let band = 'red';
    if (absDiff <= toleranceGrams) {
        band = 'green';
    } else if (absDiff <= toleranceGrams * 3) {
        band = 'amber';
    }

    let stateText;
    if (!connected) {
        stateText = 'Reconnecting…';
    } else if (sessionState === 'device_lost') {
        stateText = 'Device offline';
    } else if (sessionState === 'cancelled') {
        stateText = 'Cancelled';
    } else if (sessionState === 'committed') {
        stateText = 'Confirmed';
    } else if (sessionState === 'failed_insufficient_balance') {
        stateText = 'Insufficient balance';
    } else if (sessionState === 'confirming') {
        const seconds = Math.max(1, Math.ceil((msLeft ?? 0) / 1000));
        stateText = `Hold — confirming in ${seconds}…`;
    } else if (gramsInt < 50) {
        stateText = 'Place the container';
    } else if (diff < -toleranceGrams) {
        stateText = `Add ${commodityLabel}`;
    } else if (diff > toleranceGrams) {
        stateText = `Remove ${commodityLabel}`;
    } else {
        stateText = 'Steady…';
    }

    const bandClasses = {
        green: 'border-success-border bg-success-bg text-success-text',
        amber: 'border-warning-border bg-warning-bg text-warning-text',
        red: 'border-danger-border bg-danger-bg text-danger-text',
    };

    const isTerminal = TERMINAL_STATES.includes(sessionState);

    return (
        <div className="space-y-4">
            <Card>
                <h2 className="text-lg font-semibold text-text-primary">{beneficiaryName}</h2>
                <p className="mt-1 text-sm text-text-secondary">Card: {cardNumber}</p>
            </Card>

            <Card className={`border-2 ${bandClasses[band]}`} bodyClassName="text-center py-8">
                {sessionState === 'device_lost' && (
                    <WifiOff size={28} className="mx-auto mb-2" aria-hidden="true" />
                )}
                <p className="text-5xl font-bold tabular-nums">{gramsInt.toLocaleString()} g</p>
                <p className="mt-2 text-sm text-text-secondary">
                    Target: {entitledGrams.toLocaleString()} g &plusmn; {toleranceGrams}g
                </p>
                <p className="mt-4 text-xl font-semibold" role="status" aria-live="polite">
                    {stateText}
                </p>
            </Card>

            <Button
                variant="danger"
                className="h-12 w-full text-base"
                onClick={handleCancel}
                disabled={cancelling || isTerminal}
            >
                {cancelling ? 'Cancelling…' : 'Cancel'}
            </Button>

            <Modal
                isOpen={isTerminal}
                onClose={() => onDone(sessionState)}
                title={stateText}
                footer={
                    <Button variant="primary" onClick={() => onDone(sessionState)}>
                        Done
                    </Button>
                }
            >
                <p className="text-sm text-text-secondary">
                    {sessionState === 'committed' &&
                        `Dispensed ${gramsInt.toLocaleString()}g of ${commodityLabel} to ${beneficiaryName}.`}
                    {sessionState === 'cancelled' && 'The dispense was cancelled.'}
                    {sessionState === 'device_lost' &&
                        'The weighing scale disconnected — please reconnect it and restart the dispense.'}
                    {sessionState === 'failed_insufficient_balance' &&
                        "The measured weight exceeded the beneficiary's remaining balance."}
                </p>
            </Modal>
        </div>
    );
};

export default DispenseWeighingPanel;
