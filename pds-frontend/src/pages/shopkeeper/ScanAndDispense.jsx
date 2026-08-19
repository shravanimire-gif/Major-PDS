import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, Gauge, WifiOff } from 'lucide-react';
import api from '../../api/axios';
import QRScanner from '../../components/shopkeeper/QRScanner';
import DispenseWeighingPanel from '../../components/shopkeeper/DispenseWeighingPanel';
import useToast from '../../components/ui/useToast';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

const FLOW = {
  SCANNING: 'SCANNING',
  BENEFICIARY_LOADED: 'BENEFICIARY_LOADED',
  CONFIRMATION: 'CONFIRMATION',
  WEIGHING: 'WEIGHING',
  SUCCESS: 'SUCCESS',
};

const COMMODITY_BY_QTY_KEY = {
  rice_qty_kg: 'rice',
  wheat_qty_kg: 'wheat',
};

const OUTCOME_TOAST = {
  committed: { type: 'success', message: 'Dispensed successfully via the IoT scale.' },
  cancelled: { type: 'warning', message: 'Weighing cancelled.' },
  device_lost: { type: 'danger', message: 'Weighing scale disconnected — please reconnect and restart.' },
  failed_insufficient_balance: { type: 'danger', message: 'Measured weight exceeded the remaining balance.' },
  failed_already_claimed: {
    type: 'danger',
    message: 'This ration card has already claimed this commodity for the current month.',
  },
  failed_out_of_tolerance: {
    type: 'danger',
    message: 'Final weight was outside the allowed tolerance — nothing was dispensed.',
  },
};

const emptyQuantities = {
  rice_qty_kg: 0,
  wheat_qty_kg: 0,
};

const parseQrPayload = (rawText) => {
  try {
    const parsed = JSON.parse(rawText);

    if (!parsed.rationCardId || !parsed.sessionId || !parsed.expiresAt) {
      return { valid: false, error: 'Invalid QR format' };
    }

    if (Number.isNaN(new Date(parsed.expiresAt).getTime())) {
      return { valid: false, error: 'Invalid QR expiry' };
    }

    if (new Date(parsed.expiresAt) < new Date()) {
      return { valid: false, error: 'QR code has expired' };
    }

    return {
      valid: true,
      payload: {
        rationCardId: parsed.rationCardId,
        sessionId: parsed.sessionId,
        expiresAt: parsed.expiresAt,
      },
    };
  } catch {
    return { valid: false, error: 'QR data is not valid JSON' };
  }
};

const ScanAndDispense = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [flowState, setFlowState] = useState(FLOW.SCANNING);
  const [loading, setLoading] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);
  const [beneficiary, setBeneficiary] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [quantities, setQuantities] = useState(emptyQuantities);
  // The card's authoritative monthly allocation, resolved server-side from its
  // category policy. This is the ONLY source for the dispensed quantity: one
  // allocation is fulfilled by one complete transaction, so the quantity is not
  // something the shopkeeper chooses.
  const [allocation, setAllocation] = useState(null);
  const [dispenseResult, setDispenseResult] = useState(null);
  // The shop's scale, as the backend reports it. `active` is the registry
  // lifecycle ("a device is registered and enabled for this shop") and
  // `connectivity` is whether a bridge is actually connected right now. Kept
  // separate because a registered-but-unplugged scale must read OFFLINE — a row
  // in PostgreSQL is not evidence that anything is on the counter.
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [weighingSession, setWeighingSession] = useState(null);

  const maxes = useMemo(
    () => ({
      rice_qty_kg: Number(wallet?.rice_balance_kg || 0),
      wheat_qty_kg: Number(wallet?.wheat_balance_kg || 0),
    }),
    [wallet],
  );

  const hasExceeded = (key) => Number(quantities[key] || 0) > maxes[key];

  // ONLINE means a bridge is connected to this shop's device right now, not
  // merely that a device row exists. 'stale' (recently seen, mid-reconnect) is
  // treated as not-usable for starting a weighing: better to say so than to open
  // a session that immediately goes device_lost.
  const scaleOnline = deviceStatus?.active === true && deviceStatus?.connectivity === 'online';
  const scaleRegistered = deviceStatus?.active === true;

  const hasAnySelected =
    Number(quantities.rice_qty_kg) > 0 ||
    Number(quantities.wheat_qty_kg) > 0;

  const selectedItems = [
    { key: 'rice_qty_kg', label: 'Rice' },
    { key: 'wheat_qty_kg', label: 'Wheat' },
  ].filter((item) => Number(quantities[item.key]) > 0);

  const resetToScan = () => {
    setFlowState(FLOW.SCANNING);
    setLoading(false);
    setQrPayload(null);
    setBeneficiary(null);
    setWallet(null);
    setQuantities(emptyQuantities);
    setAllocation(null);
    setDispenseResult(null);
    setDeviceStatus(null);
    setWeighingSession(null);
  };

  const fetchBeneficiary = async (payload) => {
    setLoading(true);

    try {
      const [beneficiaryRes, deviceStatusRes] = await Promise.all([
        api.get(`/api/shopkeeper/beneficiary/${payload.rationCardId}`, {
          params: { sessionId: payload.sessionId, expiresAt: payload.expiresAt },
        }),
        api
          .get('/api/dispense/device-status')
          .catch(() => ({ data: { active: false, connectivity: 'offline' } })),
      ]);

      const loadedWallet = beneficiaryRes.data.wallet;
      const loadedAllocation = beneficiaryRes.data.allocation || null;

      setBeneficiary(beneficiaryRes.data.beneficiary);
      setWallet(loadedWallet);
      setAllocation(loadedAllocation);

      // The quantity IS the allocation — never a shopkeeper input, and never
      // the wallet balance. They differ when the month's claim has already been
      // taken, and in that case the wallet check below refuses the dispense
      // rather than quietly serving a smaller amount (which would consume the
      // claim and strand the remainder).
      setQuantities(
        loadedAllocation
          ? { rice_qty_kg: loadedAllocation.rice_kg, wheat_qty_kg: loadedAllocation.wheat_kg }
          : emptyQuantities,
      );
      setDeviceStatus(deviceStatusRes.data);
      setFlowState(FLOW.BENEFICIARY_LOADED);
    } catch (error) {
      toast.danger(error.response?.data?.error || 'Failed to load beneficiary');
      resetToScan();
    } finally {
      setLoading(false);
    }
  };

  // Starts an IoT-gated weighing session for one commodity (one container on
  // one scale at a time — see PHASE2_DONE.md) using the already-scanned QR
  // session as the identity proof, then attaches the shop's device.
  const handleWeighOnScale = async (qtyKey) => {
    const commodity = COMMODITY_BY_QTY_KEY[qtyKey];
    // Grams comes from the allocation the server resolved, not from the kg field
    // — a kg round-trip could lose grams, and the backend rejects any value that
    // is not exactly the card's allocation.
    const entitledGrams = commodity === 'rice' ? allocation?.rice_grams : allocation?.wheat_grams;

    if (!entitledGrams || entitledGrams <= 0) {
      toast.warning('No allocation available for this commodity');
      return;
    }

    setLoading(true);
    try {
      const createRes = await api.post('/api/dispense/session', {
        ration_card_id: beneficiary.ration_card_id,
        commodity,
        entitled_grams: entitledGrams,
        qr_session_id: qrPayload.sessionId,
      });

      const { session_id: sessionId, session_jwt: sessionJwt, tolerance_grams: toleranceGrams } = createRes.data;

      await api.post(`/api/dispense/session/${sessionId}/attach`, { session_jwt: sessionJwt });

      setWeighingSession({ sessionId, commodity, entitledGrams, toleranceGrams });
      setFlowState(FLOW.WEIGHING);
    } catch (error) {
      toast.danger(error.response?.data?.error || 'Failed to start weighing session');
    } finally {
      setLoading(false);
    }
  };

  const handleWeighingDone = (outcome) => {
    const toastSpec = OUTCOME_TOAST[outcome];
    if (toastSpec) {
      toast[toastSpec.type](toastSpec.message);
    }
    resetToScan();
  };

  const handleScanResult = (rawText) => {
    const parsed = parseQrPayload(rawText);

    if (!parsed.valid) {
      toast.danger(parsed.error);
      return;
    }

    setQrPayload(parsed.payload);
    fetchBeneficiary(parsed.payload);
  };

  const handleOpenConfirm = () => {
    if (!hasAnySelected) {
      toast.warning('Select at least one quantity');
      return;
    }

    if (hasExceeded('rice_qty_kg') || hasExceeded('wheat_qty_kg')) {
      toast.warning('Quantity cannot exceed wallet balance');
      return;
    }

    setFlowState(FLOW.CONFIRMATION);
  };

  const handleDispense = async () => {
    setLoading(true);

    try {
      const { data } = await api.post('/api/shopkeeper/dispense', {
        ration_card_id: beneficiary.ration_card_id,
        session_id: qrPayload.sessionId,
        rice_qty_kg: Number(quantities.rice_qty_kg || 0),
        wheat_qty_kg: Number(quantities.wheat_qty_kg || 0),
      });

      setDispenseResult(data);
      setFlowState(FLOW.SUCCESS);
      toast.success('Dispensed successfully.');
    } catch (error) {
      setFlowState(FLOW.BENEFICIARY_LOADED);
      toast.danger(error.response?.data?.error || 'Dispense failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Scan &amp; Dispense</h1>
        <button
          type="button"
          onClick={() => navigate('/shopkeeper/dashboard')}
          className="rounded-sm text-sm text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Back
        </button>
      </div>

      {flowState === FLOW.SCANNING && (
        <Card>
          {loading ? (
            <p className="py-10 text-center text-text-secondary">Fetching beneficiary...</p>
          ) : (
            <QRScanner
              onScan={handleScanResult}
              onError={() => toast.danger('Camera access failed. Please allow camera permission.')}
            />
          )}
        </Card>
      )}

      {(flowState === FLOW.BENEFICIARY_LOADED || flowState === FLOW.CONFIRMATION) && beneficiary && wallet && (
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold text-text-primary">{beneficiary.name}</h2>
            <p className="mt-1 text-sm text-text-secondary">Card: {beneficiary.card_number}</p>
            <p className="mt-2 text-sm text-text-secondary">Category: {beneficiary.category}</p>
            <p className="text-sm text-text-secondary">Mobile: {beneficiary.mobile || '—'}</p>
            <p className="text-sm text-text-secondary">Family Size: {beneficiary.family_size}</p>
            <p className="text-sm text-text-secondary">Shop: {beneficiary.shop_name}</p>
          </Card>

          {/* The scale's state, in the shopkeeper's terms. No COM port, no baud
              rate, no device token, no serial detail — they weigh grain, they do
              not configure hardware. */}
          {scaleRegistered && (
            <Card bodyClassName="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Gauge size={16} />
                IoT Scale
              </span>
              {scaleOnline ? (
                <Badge status="success" dot>
                  Online
                </Badge>
              ) : (
                <Badge status="danger" dot icon={<WifiOff size={12} />}>
                  Offline
                </Badge>
              )}
            </Card>
          )}

          <Card bodyClassName="space-y-4">
            <h3 className="font-semibold text-text-primary">Wallet Balance</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-sm bg-surface-muted p-3 text-center">
                <p className="text-text-secondary">Rice</p>
                <p className="text-lg font-semibold tabular-nums text-text-primary">{maxes.rice_qty_kg} kg</p>
              </div>
              <div className="rounded-sm bg-surface-muted p-3 text-center">
                <p className="text-text-secondary">Wheat</p>
                <p className="text-lg font-semibold tabular-nums text-text-primary">{maxes.wheat_qty_kg} kg</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: 'rice_qty_kg', label: 'Rice qty' },
                { key: 'wheat_qty_kg', label: 'Wheat qty' },
              ].map((field) => (
                <div key={field.key} className="space-y-2">
                  {/* Read-only: one allocation is dispensed in one complete
                      transaction, so the quantity IS the card's authorised
                      allocation. The backend derives and re-checks it and
                      rejects any partial amount, so an editable field could
                      only ever produce a validation error. */}
                  <Input
                    label={field.label}
                    type="number"
                    readOnly
                    value={quantities[field.key]}
                    hint={
                      allocation
                        ? 'Full monthly allocation — partial dispensing is not supported'
                        : 'Allocation unavailable — no policy is configured for this card'
                    }
                    error={hasExceeded(field.key) ? 'Already claimed this month (wallet is short)' : undefined}
                    inputClassName="h-11"
                  />
                  {scaleRegistered && Number(quantities[field.key]) > 0 && !hasExceeded(field.key) && (
                    <Button
                      variant="secondary"
                      className="h-9 w-full text-xs"
                      onClick={() => handleWeighOnScale(field.key)}
                      disabled={loading || !scaleOnline}
                      title={scaleOnline ? undefined : 'The IoT scale is offline'}
                    >
                      <Gauge size={14} />
                      {scaleOnline ? 'Weigh on Scale' : 'Scale offline'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" className="h-11 flex-1" onClick={handleOpenConfirm}>
                Confirm Dispense
              </Button>
              <Button variant="secondary" className="h-11 flex-1" onClick={resetToScan}>
                Scan Again
              </Button>
            </div>
          </Card>
        </div>
      )}

      {flowState === FLOW.WEIGHING && weighingSession && beneficiary && (
        <DispenseWeighingPanel
          sessionId={weighingSession.sessionId}
          commodity={weighingSession.commodity}
          entitledGrams={weighingSession.entitledGrams}
          toleranceGrams={weighingSession.toleranceGrams}
          beneficiaryName={beneficiary.name}
          cardNumber={beneficiary.card_number}
          onDone={handleWeighingDone}
        />
      )}

      {flowState === FLOW.SUCCESS && dispenseResult && (
        <Card className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-success-border bg-success-bg text-success-text">
            <CircleCheck size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-text-primary">Dispensed Successfully</h2>

          <div className="mt-5 space-y-2 text-sm text-text-secondary">
            <p>
              Dispensed: Rice {dispenseResult.dispensed.rice_qty_kg} kg, Wheat {dispenseResult.dispensed.wheat_qty_kg} kg
            </p>
            <p>
              Remaining: Rice {dispenseResult.remaining_wallet.rice_balance_kg} kg, Wheat{' '}
              {dispenseResult.remaining_wallet.wheat_balance_kg} kg
            </p>
          </div>

          <Button variant="primary" className="mt-6 h-11 px-6" onClick={resetToScan}>
            Scan Next
          </Button>
        </Card>
      )}

      <Modal
        isOpen={flowState === FLOW.CONFIRMATION}
        onClose={() => setFlowState(FLOW.BENEFICIARY_LOADED)}
        title="Confirm Dispense"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFlowState(FLOW.BENEFICIARY_LOADED)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDispense} disabled={loading}>
              {loading ? 'Processing...' : 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-text-secondary">Beneficiary: {beneficiary?.name}</p>
        <div className="space-y-1 text-sm text-text-primary">
          {selectedItems.map((item) => (
            <p key={item.key}>
              {item.label}: {quantities[item.key]} kg
            </p>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default ScanAndDispense;
