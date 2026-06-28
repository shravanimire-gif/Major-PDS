import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import QRScanner from '../../components/shopkeeper/QRScanner';

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
  } catch (error) {
    return { valid: false, error: 'QR data is not valid JSON' };
  }
};

const ScanAndDispense = () => {
  const [flowState, setFlowState] = useState(FLOW.SCANNING);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
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

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

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
      showToast(error.response?.data?.error || 'Failed to load beneficiary');
      resetToScan();
    } finally {
      setLoading(false);
    }
  };

  const handleScanResult = (rawText) => {
    const parsed = parseQrPayload(rawText);

    if (!parsed.valid) {
      showToast(parsed.error);
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
      showToast('Select at least one quantity');
      return;
    }

    if (hasExceeded('rice_qty_kg') || hasExceeded('wheat_qty_kg') || hasExceeded('sugar_qty_kg')) {
      showToast('Quantity cannot exceed wallet balance');
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
    } catch (error) {
      setFlowState(FLOW.BENEFICIARY_LOADED);
      showToast(error.response?.data?.error || 'Dispense failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl sm:text-2xl font-bold">Scan & Dispense</h1>
          <Link to="/shopkeeper/dashboard" className="text-sm text-gray-300 hover:text-white">
            Back
          </Link>
        </div>

        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-red-900/90 border border-red-700 text-red-200 text-sm rounded-lg px-4 py-2 shadow-lg">
            {toast}
          </div>
        )}

        {flowState === FLOW.SCANNING && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            {loading ? (
              <p className="text-gray-400 text-center py-10">Fetching beneficiary...</p>
            ) : (
              <QRScanner
                onScan={handleScanResult}
                onError={() => {
                  showToast('Camera access failed. Please allow camera permission.');
                }}
              />
            )}
          </div>
        )}

        {(flowState === FLOW.BENEFICIARY_LOADED || flowState === FLOW.CONFIRMATION) && beneficiary && wallet && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{beneficiary.name}</h2>
              <p className="text-sm text-gray-400 mt-1">Card: {beneficiary.card_number}</p>
              <p className="text-sm text-gray-300 mt-2">Category: {beneficiary.category}</p>
              <p className="text-sm text-gray-300">Mobile: {beneficiary.mobile || '—'}</p>
              <p className="text-sm text-gray-300">Family Size: {beneficiary.family_size}</p>
              <p className="text-sm text-gray-300">Shop: {beneficiary.shop_name}</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold">Wallet Balance</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-gray-400">Rice</p>
                  <p className="text-lg font-semibold">{maxes.rice_qty_kg} kg</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-gray-400">Wheat</p>
                  <p className="text-lg font-semibold">{maxes.wheat_qty_kg} kg</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-gray-400">Sugar</p>
                  <p className="text-lg font-semibold">{maxes.sugar_qty_kg} kg</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'rice_qty_kg', label: 'Rice qty' },
                  { key: 'wheat_qty_kg', label: 'Wheat qty' },
                  { key: 'sugar_qty_kg', label: 'Sugar qty' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm text-gray-300 mb-1">{field.label}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quantities[field.key]}
                      onChange={(event) => handleQtyChange(field.key, event.target.value)}
                      className={`w-full rounded-lg bg-gray-800 border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${hasExceeded(field.key) ? 'border-red-500' : 'border-gray-700'
                        }`}
                    />
                    {hasExceeded(field.key) && (
                      <p className="text-xs text-red-400 mt-1">Cannot exceed {maxes[field.key]} kg</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleOpenConfirm}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-semibold"
                >
                  Confirm Dispense
                </button>
                <button
                  type="button"
                  onClick={resetToScan}
                  className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 px-5 py-3 text-sm"
                >
                  Scan Again
                </button>
              </div>
            </div>
          </div>
        )}

        {flowState === FLOW.SUCCESS && dispenseResult && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center text-3xl text-green-400">
              ✓
            </div>
            <h2 className="text-2xl font-bold mt-4">Dispensed Successfully</h2>

            <div className="mt-5 text-sm text-gray-300 space-y-2">
              <p>
                Dispensed: Rice {dispenseResult.dispensed.rice_qty_kg} kg, Wheat{' '}
                {dispenseResult.dispensed.wheat_qty_kg} kg, Sugar {dispenseResult.dispensed.sugar_qty_kg} kg
              </p>
              <p>
                Remaining: Rice {dispenseResult.remaining_wallet.rice_balance_kg} kg, Wheat{' '}
                {dispenseResult.remaining_wallet.wheat_balance_kg} kg, Sugar{' '}
                {dispenseResult.remaining_wallet.sugar_balance_kg} kg
              </p>
            </div>

            <button
              type="button"
              onClick={resetToScan}
              className="mt-6 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold"
            >
              Scan Next
            </button>
          </div>
        )}

        {flowState === FLOW.CONFIRMATION && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Confirm Dispense</h3>
              <p className="text-sm text-gray-400 mb-4">Beneficiary: {beneficiary?.name}</p>
              <div className="text-sm text-gray-200 space-y-1 mb-5">
                {selectedItems.map((item) => (
                  <p key={item.key}>
                    {item.label}: {quantities[item.key]} kg
                  </p>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFlowState(FLOW.BENEFICIARY_LOADED)}
                  className="flex-1 rounded-lg bg-gray-800 hover:bg-gray-700 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDispense}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanAndDispense;
