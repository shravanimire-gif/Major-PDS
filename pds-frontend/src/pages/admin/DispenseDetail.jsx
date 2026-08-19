import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts';
import useApiQuery from '../../hooks/useApiQuery';
import PanelHeader from '../../design/primitives/PanelHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ShopTimestamp from '../../components/ui/ShopTimestamp';

const STATE_BADGE = {
    committed: 'success',
    cancelled: 'neutral',
    device_lost: 'danger',
    failed_insufficient_balance: 'danger',
};

const DispenseDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'Dispense Detail — PDS Supervision';
    }, []);

    const { data, loading, error } = useApiQuery(`/api/admin/iot/sessions/${id}`);

    if (loading) {
        return (
            <>
                <PanelHeader title="Dispense Detail" />
                <Card>Loading session…</Card>
            </>
        );
    }
    if (error) {
        return (
            <>
                <PanelHeader title="Dispense Detail" />
                <Card>{error}</Card>
            </>
        );
    }
    if (!data) {
        return <PanelHeader title="Dispense Detail" />;
    }

    const { session, readings, dispense_record: record } = data;
    const chartData = readings.map((r) => ({ t: new Date(r.taken_at).getTime(), grams: r.grams_int }));
    const low = session.entitled_grams - session.tolerance_grams;
    const high = session.entitled_grams + session.tolerance_grams;
    const commitTime = record ? new Date(record.committed_at).getTime() : null;

    return (
        <>
            <PanelHeader title="Dispense Detail" />
            <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dispenses')}>
                    Back to sessions
                </Button>

                <Card bodyClassName="space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-text-primary">
                            {session.shop_name} — {session.commodity}
                            {session.card_number ? (
                                <span className="ml-2 text-ds-body font-normal text-ds-text-secondary">
                                    · card {session.card_number}
                                    {session.category ? ` (${session.category})` : ''}
                                </span>
                            ) : null}
                        </h2>
                        <Badge status={STATE_BADGE[session.state] || 'neutral'}>{session.state}</Badge>
                    </div>
                    <p className="text-sm text-text-secondary">
                        Entitled: {session.entitled_grams.toLocaleString()}g &plusmn; {session.tolerance_grams}g tolerance
                    </p>
                    <p className="text-sm text-text-secondary">
                        Opened: <ShopTimestamp value={session.opened_at} />
                    </p>
                    {record && (
                        <p className="text-sm text-text-secondary">
                            Committed: <ShopTimestamp value={record.committed_at} /> — measured{' '}
                            {record.measured_grams.toLocaleString()}g
                            {record.blockchain_tx_hash ? ' — anchored' : ' — anchor pending'}
                        </p>
                    )}
                </Card>

                <Card>
                    <h3 className="mb-3 font-semibold text-text-primary">Reading trace</h3>
                    {chartData.length === 0 ? (
                        <p className="text-sm text-text-secondary">No readings were recorded for this session.</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="t"
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={(t) => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                />
                                <YAxis unit="g" domain={['auto', 'auto']} />
                                <Tooltip
                                    labelFormatter={(t) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                    formatter={(value) => [`${value.toLocaleString()} g`, 'Weight']}
                                />
                                <ReferenceArea y1={low} y2={high} fill="var(--color-success-bg, #d1fae5)" fillOpacity={0.4} />
                                <ReferenceLine y={session.entitled_grams} strokeDasharray="4 4" label="Target" />
                                {commitTime && (
                                    <ReferenceLine x={commitTime} stroke="#16a34a" strokeWidth={2} label="Committed" />
                                )}
                                <Line type="monotone" dataKey="grams" stroke="#2563eb" dot={false} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>
        </>
    );
};

export default DispenseDetail;
