import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useApiQuery from '../../hooks/useApiQuery';
import PanelHeader from '../../design/primitives/PanelHeader';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Pagination from '../../components/ui/Pagination';
import ShopTimestamp from '../../components/ui/ShopTimestamp';

const STATE_BADGE = {
    active: 'neutral',
    attached: 'info',
    weighing: 'info',
    confirming: 'warning',
    committed: 'success',
    cancelled: 'neutral',
    device_lost: 'danger',
    failed_insufficient_balance: 'danger',
    expired: 'neutral',
};

const STATE_OPTIONS = [
    'active',
    'attached',
    'weighing',
    'confirming',
    'committed',
    'cancelled',
    'device_lost',
    'failed_insufficient_balance',
    'expired',
];

const Dispenses = () => {
    const navigate = useNavigate();
    const [state, setState] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        document.title = 'Dispenses — PDS Supervision';
    }, []);

    const { data, loading, error } = useApiQuery('/api/admin/iot/sessions', {
        params: { state: state || undefined, page },
    });

    const sessions = data?.sessions || [];
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <>
            <PanelHeader title="Dispenses" />
            <div className="space-y-4">
                <Card bodyClassName="flex items-end gap-4">
                    <Select
                        label="State"
                        value={state}
                        onChange={(e) => {
                            setState(e.target.value);
                            setPage(1);
                        }}
                        className="max-w-xs"
                    >
                        <option value="">All states</option>
                        {STATE_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </Select>
                </Card>

                <Card>
                    <Table footer={<Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}>
                        <Table.Head>
                            <tr>
                                <Table.Cell header>Shop</Table.Cell>
                                {/* The beneficiary a dispense served was previously not shown
                                    anywhere on this screen — rows carried no card number and no
                                    visible session id, so "who received this grain?" could not be
                                    answered from the list at all. */}
                                <Table.Cell header>Beneficiary</Table.Cell>
                                <Table.Cell header>Commodity</Table.Cell>
                                <Table.Cell header numeric>Entitled (g)</Table.Cell>
                                <Table.Cell header numeric>Measured (g)</Table.Cell>
                                <Table.Cell header>State</Table.Cell>
                                <Table.Cell header>Opened</Table.Cell>
                                <Table.Cell header>Anchored</Table.Cell>
                            </tr>
                        </Table.Head>
                        <Table.Body>
                            {loading && <Table.LoadingRows rows={8} columns={8} />}
                            {!loading && error && <Table.Empty colSpan={8}>{error}</Table.Empty>}
                            {!loading && !error && sessions.length === 0 && (
                                <Table.Empty colSpan={8}>No sessions match these filters.</Table.Empty>
                            )}
                            {!loading &&
                                !error &&
                                sessions.map((session) => (
                                    <Table.Row
                                        key={session.id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/admin/dispenses/${session.id}`)}
                                    >
                                        <Table.Cell>{session.shop_name}</Table.Cell>
                                        <Table.Cell>
                                            {session.card_number || (
                                                <span className="text-text-secondary">—</span>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="capitalize">{session.commodity}</Table.Cell>
                                        <Table.Cell numeric>{session.entitled_grams.toLocaleString()}</Table.Cell>
                                        <Table.Cell numeric>
                                            {session.measured_grams != null ? session.measured_grams.toLocaleString() : '—'}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge status={STATE_BADGE[session.state] || 'neutral'}>{session.state}</Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <ShopTimestamp value={session.opened_at} />
                                        </Table.Cell>
                                        <Table.Cell>
                                            {session.blockchain_tx_hash ? (
                                                <Badge status="success">Anchored</Badge>
                                            ) : session.dispense_record_id ? (
                                                <Badge status="warning">Pending</Badge>
                                            ) : (
                                                '—'
                                            )}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                        </Table.Body>
                    </Table>
                </Card>
            </div>
        </>
    );
};

export default Dispenses;
