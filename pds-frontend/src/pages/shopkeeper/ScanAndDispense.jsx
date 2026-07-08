import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import api from '../../api/axios';
import QRScanner from '../../components/shopkeeper/QRScanner';
import useToast from '../../components/ui/useToast';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const FLOW = {
  SCANNING: 'SCANNING',
  BENEFICIARY_LOADED: 'BENEFICIARY_LOADED',
  CONFIRMATION: 'CONFIRMATION',
  SUCCESS: 'SUCCESS',
};

const emptyQuantities = {
  rice_qty_kg: 0,
  wheat_qty_kg: 0,
  sugar_qty_kg: 0,
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
  const [dispenseResult, setDispenseResult] = useState(null);

  const maxes = useMemo(
    () => ({
      rice_qty_kg: Number(wallet?.rice_balance_kg || 0),
      wheat_qty_kg: Number(wallet?.wheat_balance_kg || 0),
      sugar_qty_kg: Number(wallet?.sugar_balance_kg || 0),
    }),
    [wallet],
  );

  const hasExceeded = (key) => Number(quantities[key] || 0) > maxes[key];

  const hasAnySelected =
    Number(quantities.rice_qty_kg) > 0 ||
    Number(quantities.wheat_qty_kg) > 0 ||
    Number(quantities.sugar_qty_kg) > 0;

  const selectedItems = [
    { key: 'rice_qty_kg', label: 'Rice' },
    { key: 'wheat_qty_kg', label: 'Wheat' },
    { key: 'sugar_qty_kg', label: 'Sugar' },
  ].filter((item) => Number(quantities[item.key]) > 0);

  const resetToScan = () => {
    setFlowState(FLOW.SCANNING);
    setLoading(false);
    setQrPayload(null);
    setBeneficiary(null);
    setWallet(null);
    setQuantities(emptyQuantities);
    setDispenseResult(null);
  };

  const fetchBeneficiary = async (payload) => {
    setLoading(true);

    try {
      const response = await api.get(`/api/shopkeeper/beneficiary/${payload.rationCardId}`, {
        params: {
          sessionId: payload.sessionId,
          expiresAt: payload.expiresAt,
        },
      });

      setBeneficiary(response.data.beneficiary);
      setWallet(response.data.wallet);
      setQuantities(emptyQuantities);
      setFlowState(FLOW.BENEFICIARY_LOADED);
    } catch (error) {
      toast.danger(error.response?.data?.error || 'Failed to load beneficiary');
      resetToScan();
    } finally {
      setLoading(false);
    }
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

  const handleQtyChange = (key, value) => {
    const parsed = value === '' ? 0 : Number(value);
    setQuantities((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  const handleOpenConfirm = () => {
    if (!hasAnySelected) {
      toast.warning('Select at least one quantity');
      return;
    }

    if (hasExceeded('rice_qty_kg') || hasExceeded('wheat_qty_kg') || hasExceeded('sugar_qty_kg')) {
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
        sugar_qty_kg: Number(quantities.sugar_qty_kg || 0),
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
          className="text-sm text-text-secondary hover:text-text-primary"
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

          <Card className="space-y-4">
            <h3 className="font-semibold text-text-primary">Wallet Balance</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-sm bg-surface-muted p-3 text-center">
                <p className="text-text-secondary">Rice</p>
                <p className="text-lg font-semibold tabular-nums text-text-primary">{maxes.rice_qty_kg} kg</p>
              </div>
              <div className="rounded-sm bg-surface-muted p-3 text-center">
                <p className="text-text-secondary">Wheat</p>
                <p className="text-lg font-semibold tabular-nums text-text-primary">{maxes.wheat_qty_kg} kg</p>
              </div>
              <div className="rounded-sm bg-surface-muted p-3 text-center">
                <p className="text-text-secondary">Sugar</p>
                <p className="text-lg font-semibold tabular-nums text-text-primary">{maxes.sugar_qty_kg} kg</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { key: 'rice_qty_kg', label: 'Rice qty' },
                { key: 'wheat_qty_kg', label: 'Wheat qty' },
                { key: 'sugar_qty_kg', label: 'Sugar qty' },
              ].map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantities[field.key]}
                  onChange={(event) => handleQtyChange(field.key, event.target.value)}
                  error={hasExceeded(field.key) ? `Cannot exceed ${maxes[field.key]} kg` : undefined}
                  className="h-11"
                />
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

      {flowState === FLOW.SUCCESS && dispenseResult && (
        <Card className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-success-border bg-success-bg text-success-text">
            <CircleCheck size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-text-primary">Dispensed Successfully</h2>

          <div className="mt-5 space-y-2 text-sm text-text-secondary">
            <p>
              Dispensed: Rice {dispenseResult.dispensed.rice_qty_kg} kg, Wheat {dispenseResult.dispensed.wheat_qty_kg} kg,
              Sugar {dispenseResult.dispensed.sugar_qty_kg} kg
            </p>
            <p>
              Remaining: Rice {dispenseResult.remaining_wallet.rice_balance_kg} kg, Wheat{' '}
              {dispenseResult.remaining_wallet.wheat_balance_kg} kg, Sugar {dispenseResult.remaining_wallet.sugar_balance_kg} kg
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
