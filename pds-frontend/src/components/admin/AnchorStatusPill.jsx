import { useEffect, useState } from 'react';
import { CircleCheck, CircleAlert, CircleX } from 'lucide-react';
import api from '../../api/axios';
import Badge from '../ui/Badge';

// GET /api/admin/iot/anchor-status once on mount — a status pill, not a
// live widget (never auto-refreshes; the fleet page's own refetch, e.g.
// after Recalibrate, doesn't touch this either — it's independent data).
const LEVEL_META = {
    ok: { status: 'success', icon: CircleCheck, label: 'Anchoring OK' },
    amber: { status: 'warning', icon: CircleAlert, label: 'Anchor backlog building' },
    red: { status: 'danger', icon: CircleX, label: 'Anchor backlog critical' },
};

const AnchorStatusPill = () => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        api
            .get('/api/admin/iot/anchor-status')
            .then((res) => {
                if (!cancelled) setStatus(res.data);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <Badge status="neutral" dot>
                Loading anchor status…
            </Badge>
        );
    }

    if (!status) {
        return null;
    }

    const meta = LEVEL_META[status.level] || LEVEL_META.ok;
    const Icon = meta.icon;

    return (
        <Badge status={meta.status} icon={<Icon size={14} />} title={`Pending: ${status.pending_count}`}>
            {meta.label} ({status.pending_count} pending)
        </Badge>
    );
};

export default AnchorStatusPill;
