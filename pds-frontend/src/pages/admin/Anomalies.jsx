import { useEffect, useState } from 'react';
import api from '../../api/axios';
import useApiQuery from '../../hooks/useApiQuery';
import useToast from '../../components/ui/useToast';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ShopTimestamp from '../../components/ui/ShopTimestamp';
import PanelHeader from '../../design/primitives/PanelHeader';

const SEVERITY_BADGE = { info: 'info', warn: 'warning', critical: 'danger' };

const Anomalies = () => {
    const toast = useToast();
    const [severity, setSeverity] = useState('');
    const [resolved, setResolved] = useState('false');
    const [resolveTarget, setResolveTarget] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { document.title = 'Anomalies — PDS Supervision'; }, []);

    const { data, loading, error, refetch } = useApiQuery('/api/admin/anomalies', {
        params: { severity: severity || undefined, resolved },
    });

    const flags = data?.flags || [];

    const isResolved = (flag) => Boolean(flag.resolved_at || flag.auto_resolved_at);

    const handleConfirmResolve = async () => {
        setSubmitting(true);
        try {
            await api.post(`/api/admin/anomalies/${resolveTarget.id}/resolve`);
            toast.success('Flag resolved.');
            setResolveTarget(null);
            await refetch();
        } catch (err) {
            toast.danger(err.response?.data?.error || 'Failed to resolve flag');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <PanelHeader title="Anomalies" />
            <div className="space-y-4">
            <Card bodyClassName="flex items-end gap-4">
                <Select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="max-w-xs">
                    <option value="">All severities</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="critical">Critical</option>
                </Select>
                <Select label="Status" value={resolved} onChange={(e) => setResolved(e.target.value)} className="max-w-xs">
                    <option value="false">Unresolved</option>
                    <option value="true">Resolved</option>
                    <option value="">All</option>
                </Select>
            </Card>

            <Card>
                <Table>
                    <Table.Head>
                        <tr>
                            <Table.Cell header>Rule</Table.Cell>
                            <Table.Cell header>Shop</Table.Cell>
                            <Table.Cell header>Severity</Table.Cell>
                            <Table.Cell header>Description</Table.Cell>
                            <Table.Cell header>Raised</Table.Cell>
                            <Table.Cell header>Status</Table.Cell>
                            <Table.Cell header>Actions</Table.Cell>
                        </tr>
                    </Table.Head>
                    <Table.Body>
                        {loading && <Table.LoadingRows rows={6} columns={7} />}
                        {!loading && error && <Table.Empty colSpan={7}>{error}</Table.Empty>}
                        {!loading && !error && flags.length === 0 && (
                            <Table.Empty colSpan={7}>No anomaly flags match these filters.</Table.Empty>
                        )}
                        {!loading &&
                            !error &&
                            flags.map((flag) => (
                                <Table.Row key={flag.id}>
                                    <Table.Cell>{flag.rule_key}</Table.Cell>
                                    <Table.Cell>{flag.shop_name}</Table.Cell>
                                    <Table.Cell>
                                        <Badge status={SEVERITY_BADGE[flag.severity] || 'neutral'}>{flag.severity}</Badge>
                                    </Table.Cell>
                                    <Table.Cell className="max-w-md">{flag.description}</Table.Cell>
                                    <Table.Cell>
                                        <ShopTimestamp value={flag.created_at} />
                                    </Table.Cell>
                                    <Table.Cell>
                                        {flag.resolved_at ? (
                                            <Badge status="success">Resolved</Badge>
                                        ) : flag.auto_resolved_at ? (
                                            <Badge status="success">Auto-resolved</Badge>
                                        ) : (
                                            <Badge status="warning">Unresolved</Badge>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {!isResolved(flag) && (
                                            <Button variant="secondary" size="sm" onClick={() => setResolveTarget(flag)}>
                                                Resolve
                                            </Button>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                    </Table.Body>
                </Table>
            </Card>

            <Modal
                isOpen={Boolean(resolveTarget)}
                onClose={() => setResolveTarget(null)}
                title="Resolve anomaly flag"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setResolveTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleConfirmResolve} disabled={submitting}>
                            {submitting ? 'Resolving…' : 'Confirm Resolve'}
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-text-primary">
                    This marks the <strong>{resolveTarget?.rule_key}</strong> flag for{' '}
                    <strong>{resolveTarget?.shop_name}</strong> as manually resolved.
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                    It does <strong>not</strong> change the underlying data (no session, wallet, or dispense record is
                    modified) and does <strong>not</strong> prevent the same rule from firing again later if the
                    condition recurs.
                </p>
            </Modal>
            </div>
        </>
    );
};

export default Anomalies;
