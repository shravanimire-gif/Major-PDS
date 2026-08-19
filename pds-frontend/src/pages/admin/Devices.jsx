import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Link2, Unlink, Power, PowerOff, KeyRound, Copy } from 'lucide-react';
import api from '../../api/axios';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import useToast from '../../components/ui/useToast';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import ShopTimestamp from '../../components/ui/ShopTimestamp';
import PanelHeader from '../../design/primitives/PanelHeader';

/**
 * Admin > Settings > Devices — the IoT device registry.
 *
 * Registration, assignment and enable/disable for the physical ESP32 weighing
 * devices. Health / IoT Fleet remains the operational view; this is the
 * provisioning one.
 *
 * TWO STATUSES, NEVER CONFLATED
 *   lifecycle  active | inactive | revoked   — the registry decision an admin made
 *   connectivity online | stale | offline    — whether a bridge is connected NOW
 *
 * A device row existing in PostgreSQL, or being 'active', is never rendered as
 * ONLINE. Connectivity comes from the backend's live /ws/iot connection registry
 * and last_seen_at, so an unplugged board reads OFFLINE even though its row is
 * perfectly healthy.
 *
 * CURRENT WEIGHT IS A SENSOR READING
 * The weight column is the device's most recent sensor sample. It is labelled as
 * such and visually separated from anything transactional, because a reading is
 * not a dispense: only an authorised dispense session can produce a transaction,
 * and nothing on this screen can cause one.
 */

// How often the list re-polls. Fast enough that plugging the ESP32 in shows up
// while the admin is still looking at the screen, slow enough not to matter.
const REFRESH_MS = 5000;

const CONNECTIVITY_BADGE = {
  online: { status: 'success', label: 'Online' },
  stale: { status: 'warning', label: 'Stale' },
  offline: { status: 'danger', label: 'Offline' },
};

const LIFECYCLE_BADGE = {
  active: { status: 'success', label: 'Enabled' },
  inactive: { status: 'neutral', label: 'Disabled' },
  revoked: { status: 'danger', label: 'Revoked' },
};

const COLUMNS = [
  'Device UID',
  'Name',
  'Status',
  'Assigned Shop',
  'Shopkeeper',
  'Last Seen',
  'Firmware',
  'Current Weight',
  'Created',
  'Actions',
];

const emptyRegisterForm = { device_id: '', device_name: '', shop_id: '' };

const Devices = () => {
  const toast = useToast();

  const [shops, setShops] = useState([]);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [registerError, setRegisterError] = useState('');
  const [issuedToken, setIssuedToken] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignShopId, setAssignShopId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Devices — PDS Supervision';
  }, []);

  const fetchDevices = useCallback(() => api.get('/api/admin/iot/devices').then((res) => res.data), []);
  const { data, loading, error, refetch } = useAutoRefresh(fetchDevices, { intervalMs: REFRESH_MS });

  const devices = data?.devices || [];

  // limit=500 because /api/admin/shops paginates at 20 by default, and an
  // assignment dropdown that silently omitted the target shop would look like
  // the shop did not exist.
  useEffect(() => {
    api
      .get('/api/admin/shops', { params: { limit: 500 } })
      .then((res) => setShops(res.data?.shops || []))
      .catch(() => setShops([]));
  }, []);

  // Only active shops can take a device — the backend rejects an inactive one,
  // so offering it here would only produce an error the admin can't act on.
  const assignableShops = useMemo(() => shops.filter((shop) => shop.is_active !== false), [shops]);

  const summary = useMemo(
    () => ({
      total: devices.length,
      online: devices.filter((device) => device.connectivity === 'online').length,
      unassigned: devices.filter((device) => !device.shop_id).length,
      disabled: devices.filter((device) => device.status !== 'active').length,
    }),
    [devices],
  );

  const handleRegister = async (event) => {
    event.preventDefault();
    setRegisterError('');
    setSubmitting(true);
    try {
      const payload = {
        device_id: registerForm.device_id.trim(),
        device_name: registerForm.device_name.trim() || undefined,
        // Omitted rather than sent empty: the backend treats an absent shop_id
        // as "register unassigned", which is a deliberate, valid state.
        shop_id: registerForm.shop_id || undefined,
      };
      const res = await api.post('/api/admin/iot/devices', payload);

      // The plaintext token is returned exactly once — only its bcrypt hash is
      // persisted. Held in a modal until the admin dismisses it, because a lost
      // token can only be replaced by rotating it, not recovered.
      setIssuedToken({ deviceId: res.data.device.device_id, token: res.data.token });
      setRegisterOpen(false);
      setRegisterForm(emptyRegisterForm);
      await refetch();
      toast.success(`Device ${res.data.device.device_id} registered.`);
    } catch (err) {
      setRegisterError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/api/admin/iot/devices/${assignTarget.device_id}/assignment`, {
        shop_id: assignShopId || null,
      });
      toast.success(
        assignShopId
          ? `${assignTarget.device_id} assigned. The bridge will reconnect within a few seconds.`
          : `${assignTarget.device_id} unassigned. It can no longer connect until reassigned.`,
      );
      setAssignTarget(null);
      await refetch();
    } catch (err) {
      toast.danger(err.response?.data?.error || 'Assignment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetStatus = async (device, status) => {
    try {
      await api.patch(`/api/admin/iot/devices/${device.device_id}/status`, { status });
      toast.success(`${device.device_id} ${status === 'active' ? 'enabled' : 'disabled'}.`);
      await refetch();
    } catch (err) {
      toast.danger(err.response?.data?.error || 'Could not change the device status.');
    }
  };

  const handleRotate = async (device) => {
    try {
      const res = await api.post(`/api/admin/iot/devices/${device.device_id}/rotate-token`);
      setIssuedToken({ deviceId: device.device_id, token: res.data.token, rotated: true });
      await refetch();
    } catch (err) {
      toast.danger(err.response?.data?.error || 'Could not rotate the token.');
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(issuedToken.token);
      toast.success('Token copied to the clipboard.');
    } catch {
      toast.warning('Could not copy automatically — select the token and copy it manually.');
    }
  };

  return (
    <>
      <PanelHeader
        title="Devices"
        subtitle="Register and assign physical IoT weighing devices. For live operational status, see Health / IoT Fleet."
        actions={
          <Button variant="primary" onClick={() => { setRegisterError(''); setRegisterOpen(true); }}>
            <Plus size={14} />
            Register Device
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Registered', value: summary.total },
            { label: 'Online now', value: summary.online },
            { label: 'Unassigned', value: summary.unassigned },
            { label: 'Disabled', value: summary.disabled },
          ].map((tile) => (
            <div key={tile.label} className="rounded-sm bg-surface-muted p-3">
              <p className="text-xs text-text-secondary">{tile.label}</p>
              <p className="text-xl font-semibold tabular-nums text-text-primary">{tile.value}</p>
            </div>
          ))}
        </div>

        <Card>
          <Table>
            <Table.Head>
              <tr>
                {COLUMNS.map((label) => (
                  <Table.Cell key={label} header numeric={label === 'Current Weight'}>
                    {label}
                  </Table.Cell>
                ))}
              </tr>
            </Table.Head>
            <Table.Body>
              {loading && <Table.LoadingRows rows={3} columns={COLUMNS.length} />}
              {!loading && error && (
                <Table.Empty colSpan={COLUMNS.length}>
                  {error.response?.data?.error || 'Failed to load devices.'}
                </Table.Empty>
              )}
              {!loading && !error && devices.length === 0 && (
                <Table.Empty colSpan={COLUMNS.length}>
                  No devices registered yet. Plug the ESP32 in, run <code>npm run iot:bridge</code> to read its
                  UID, then register it here.
                </Table.Empty>
              )}
              {!loading &&
                !error &&
                devices.map((device) => {
                  const connectivity = CONNECTIVITY_BADGE[device.connectivity] || CONNECTIVITY_BADGE.offline;
                  const lifecycle = LIFECYCLE_BADGE[device.status] || LIFECYCLE_BADGE.inactive;

                  return (
                    <Table.Row key={device.device_id}>
                      <Table.Cell>
                        <span className="font-mono text-xs">{device.device_id}</span>
                      </Table.Cell>
                      <Table.Cell>{device.device_name || <span className="text-text-secondary">—</span>}</Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Connectivity first: it answers "is the scale usable
                              right now", which is what an admin is looking for.
                              Lifecycle sits beside it, never merged into it. */}
                          <Badge status={connectivity.status} dot>
                            {connectivity.label}
                          </Badge>
                          <Badge status={lifecycle.status}>{lifecycle.label}</Badge>
                          {device.needs_recalibration && <Badge status="warning">Needs recalibration</Badge>}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        {device.shop_id ? (
                          <>
                            {device.shop_name}
                            <div className="text-xs text-text-secondary">{device.shop_code}</div>
                          </>
                        ) : (
                          <Badge status="warning">Unassigned</Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {device.shopkeeper_name ? (
                          <>
                            {device.shopkeeper_name}
                            <div className="text-xs text-text-secondary">{device.shopkeeper_email}</div>
                          </>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <ShopTimestamp value={device.last_seen_at} fallback="Never" />
                      </Table.Cell>
                      <Table.Cell>
                        {device.firmware_version ? (
                          <span className="font-mono text-xs">{device.firmware_version}</span>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell numeric>
                        {/* SENSOR READING, not a committed dispense. Shown greyed
                            when the device is not online, because a stale number
                            beside an OFFLINE badge otherwise reads as live. */}
                        {device.current_weight_grams === null || device.current_weight_grams === undefined ? (
                          <span className="text-text-secondary">—</span>
                        ) : (
                          <span
                            className={
                              device.connectivity === 'online'
                                ? 'tabular-nums text-text-primary'
                                : 'tabular-nums text-text-secondary'
                            }
                            title={
                              device.connectivity === 'online'
                                ? 'Live sensor reading — not a dispense'
                                : 'Last known sensor reading (device is not connected)'
                            }
                          >
                            {Number(device.current_weight_grams).toLocaleString()} g
                          </span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <ShopTimestamp value={device.created_at} />
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAssignTarget(device);
                              setAssignShopId(device.shop_id || '');
                            }}
                          >
                            {device.shop_id ? <Link2 size={14} /> : <Unlink size={14} />}
                            {device.shop_id ? 'Reassign' : 'Assign'}
                          </Button>
                          {device.status === 'active' ? (
                            <Button variant="secondary" size="sm" onClick={() => handleSetStatus(device, 'inactive')}>
                              <PowerOff size={14} />
                              Disable
                            </Button>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={() => handleSetStatus(device, 'active')}>
                              <Power size={14} />
                              Enable
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => handleRotate(device)}>
                            <KeyRound size={14} />
                            Rotate token
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
            </Table.Body>
          </Table>
        </Card>

        <p className="text-xs text-text-secondary">
          <strong>Current Weight</strong> is the device&apos;s most recent sensor reading. It is not a dispense: only
          an authorised dispense session creates a transaction, debits a wallet or writes a dispense record.
        </p>
      </div>

      {/* ---- Register ---- */}
      <Modal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        title="Register IoT device"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRegister} disabled={submitting || !registerForm.device_id.trim()}>
              {submitting ? 'Registering…' : 'Register'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleRegister} className="space-y-3">
          <Input
            label="Device UID"
            name="device_id"
            value={registerForm.device_id}
            onChange={(e) => setRegisterForm((prev) => ({ ...prev, device_id: e.target.value }))}
            placeholder="ESP32-A1B2C3"
            hint="The UID the board reports over USB serial (derived from its factory MAC). Never a COM port — port numbers change."
            required
          />
          <Input
            label="Device name (optional)"
            name="device_name"
            value={registerForm.device_name}
            onChange={(e) => setRegisterForm((prev) => ({ ...prev, device_name: e.target.value }))}
            placeholder="Dharampeth 1 — counter scale"
          />
          <Select
            label="Assign to shop (optional)"
            name="shop_id"
            value={registerForm.shop_id}
            onChange={(e) => setRegisterForm((prev) => ({ ...prev, shop_id: e.target.value }))}
            hint="Leave blank to register now and assign later. An unassigned device cannot connect."
          >
            <option value="">— Unassigned —</option>
            {assignableShops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name} ({shop.shop_code})
              </option>
            ))}
          </Select>
          {registerError && <p className="text-sm text-danger-text">{registerError}</p>}
        </form>
      </Modal>

      {/* ---- Token shown once ---- */}
      <Modal
        isOpen={Boolean(issuedToken)}
        onClose={() => setIssuedToken(null)}
        title={issuedToken?.rotated ? 'New device token' : 'Device token'}
        footer={
          <Button variant="primary" onClick={() => setIssuedToken(null)}>
            I have saved it
          </Button>
        }
      >
        <p className="text-sm text-text-primary">
          Paste this into <code>iot-bridge/.env</code> as <code>IOT_DEVICE_TOKEN</code>, then start the bridge with{' '}
          <code>npm run iot:bridge</code>.
        </p>
        <p className="mt-2 text-sm text-danger-text">
          Shown once. Only its hash is stored — if you lose it, rotate the token rather than trying to recover it.
        </p>
        <div className="mt-3 flex items-start gap-2">
          <code className="block flex-1 break-all rounded-sm bg-surface-muted p-2 font-mono text-xs">
            {issuedToken?.token}
          </code>
          <Button variant="secondary" size="sm" onClick={copyToken}>
            <Copy size={14} />
            Copy
          </Button>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          The token belongs on the PC running the bridge, not on the ESP32. Firmware secrets are visible in every
          Serial Monitor session.
        </p>
        {issuedToken?.rotated && (
          <p className="mt-2 text-xs text-text-secondary">
            The previous token keeps working for a short grace period, so a bridge that is mid-reconnect is not
            locked out the instant you rotate.
          </p>
        )}
      </Modal>

      {/* ---- Assign / unassign ---- */}
      <Modal
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={`Assign ${assignTarget?.device_id || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAssign} disabled={submitting}>
              {submitting ? 'Saving…' : assignShopId ? 'Assign' : 'Unassign'}
            </Button>
          </>
        }
      >
        <Select
          label="Shop"
          value={assignShopId}
          onChange={(e) => setAssignShopId(e.target.value)}
          hint="A device may only ever stream readings for the shop it is assigned to."
        >
          <option value="">— Unassign —</option>
          {assignableShops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.shop_name} ({shop.shop_code})
            </option>
          ))}
        </Select>
        <p className="mt-3 text-sm text-text-secondary">
          The device&apos;s live connection is dropped so the change takes effect immediately; the bridge reconnects
          within a few seconds and is re-authorised against the new assignment.
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          This is refused while the device is mid-dispense — finish or cancel that session first.
        </p>
      </Modal>
    </>
  );
};

export default Devices;
