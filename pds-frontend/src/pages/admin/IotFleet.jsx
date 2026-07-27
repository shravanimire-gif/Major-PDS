import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import api from '../../api/axios';
import useApiQuery from '../../hooks/useApiQuery';
import useToast from '../../components/ui/useToast';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ShopTimestamp from '../../components/ui/ShopTimestamp';
import AnchorStatusPill from '../../components/admin/AnchorStatusPill';
import PanelHeader from '../../design/primitives/PanelHeader';

const STATUS_BADGE = {
    online: { status: 'success', label: 'Online' },
    stale: { status: 'warning', label: 'Stale' },
    offline: { status: 'danger', label: 'Offline' },
};

const IotFleet = () => {
    const toast = useToast();
    const { data, loading, error, refetch } = useApiQuery('/api/admin/iot/fleet');
    const [recalibrateTarget, setRecalibrateTarget] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        document.title = 'IoT Fleet — PDS Supervision';
    }, []);

    const devices = data?.devices || [];

    const handleConfirmRecalibrate = async () => {
        setSubmitting(true);
        try {
            const res = await api.post(`/api/admin/iot/devices/${recalibrateTarget.device_id}/recalibrate`);
            toast.success(res.data.message);
            setRecalibrateTarget(null);
            await refetch();
        } catch (err) {
            toast.danger(err.response?.data?.error || 'Failed to trigger recalibration');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <PanelHeader title="IoT Fleet" />
            <div className="space-y-4">
            <div className="flex justify-end">
                <AnchorStatusPill />
            </div>

            <Card>
                <Table>
                    <Table.Head>
                        <tr>
                            <Table.Cell header>Shop</Table.Cell>
                            <Table.Cell header>Device</Table.Cell>
                            <Table.Cell header>Status</Table.Cell>
                            <Table.Cell header>Last Seen</Table.Cell>
                            <Table.Cell header numeric>Calibration Age</Table.Cell>
                            <Table.Cell header numeric>Sessions (24h)</Table.Cell>
                            <Table.Cell header>Actions</Table.Cell>
                        </tr>
                    </Table.Head>
                    <Table.Body>
                        {loading && <Table.LoadingRows rows={5} columns={7} />}
                        {!loading && error && (
                            <Table.Empty colSpan={7}>{error}</Table.Empty>
                        )}
                        {!loading && !error && devices.length === 0 && (
                            <Table.Empty colSpan={7}>No IoT devices registered yet.</Table.Empty>
                        )}
                        {!loading &&
                            !error &&
                            devices.map((device) => {
                                const badge = STATUS_BADGE[device.status] || STATUS_BADGE.offline;
                                return (
                                    <Table.Row key={device.device_id}>
                                        <Table.Cell>
                                            {device.shop_name}
                                            <div className="text-xs text-text-secondary">{device.shop_code}</div>
                                        </Table.Cell>
                                        <Table.Cell>{device.device_id}</Table.Cell>
                                        <Table.Cell>
                                            <Badge status={badge.status} dot>
                                                {badge.label}
                                            </Badge>
                                            {device.needs_recalibration && (
                                                <Badge status="warning" className="ml-2">
                                                    Needs recalibration
                                                </Badge>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <ShopTimestamp value={device.last_seen_at} fallback="Never" />
                                        </Table.Cell>
                                        <Table.Cell numeric>
                                            {device.calibration_age_days === null
                                                ? 'Never calibrated'
                                                : `${device.calibration_age_days}d`}
                                        </Table.Cell>
                                        <Table.Cell numeric>{device.sessions_last_24h}</Table.Cell>
                                        <Table.Cell>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setRecalibrateTarget(device)}
                                            >
                                                <Gauge size={14} />
                                                Recalibrate
                                            </Button>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                    </Table.Body>
                </Table>
            </Card>

            <Modal
                isOpen={Boolean(recalibrateTarget)}
                onClose={() => setRecalibrateTarget(null)}
                title="Recalibrate device"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setRecalibrateTarget(null)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleConfirmRecalibrate} disabled={submitting}>
                            {submitting ? 'Sending…' : 'Confirm Recalibrate'}
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-text-primary">
                    This queues a reboot into calibration mode the next time{' '}
                    <strong>{recalibrateTarget?.device_id}</strong> connects (immediately, if it's online now).
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                    It will <strong>not</strong> interrupt an active weighing session, and will{' '}
                    <strong>not</strong> disconnect the device.
                </p>
            </Modal>
            </div>
        </>
    );
};

export default IotFleet;
