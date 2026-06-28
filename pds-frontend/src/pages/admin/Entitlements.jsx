import { useMemo, useState } from "react";
import api from '../../api/axios';

const getCategoryBadgeClass = (category) => {
  if (category === "APL") return "bg-blue-900 text-blue-300";
  if (category === "BPL") return "bg-yellow-900 text-yellow-300";
  return "bg-red-900 text-red-300";
};

const formatLastAllocated = (dateString) => {
  if (!dateString) return "";

  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const Entitlements = () => {
  const [preview, setPreview] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastAllocated, setLastAllocated] = useState("");

  const totals = useMemo(() => {
    return preview.reduce(
      (acc, row) => ({
        cards: acc.cards + 1,
        rice: acc.rice + Number(row.rice_kg || 0),
        wheat: acc.wheat + Number(row.wheat_kg || 0),
        sugar: acc.sugar + Number(row.sugar_kg || 0),
      }),
      { cards: 0, rice: 0, wheat: 0, sugar: 0 },
    );
  }, [preview]);

  const loadPreview = async ({ preserveSuccess = false } = {}) => {
    setPreviewVisible(true);
    setPreviewLoading(true);
    setError("");
    if (!preserveSuccess) {
      setSuccess("");
    }

    try {
      const { data } = await api.get("/api/admin/entitlements/preview");
      const rows = data?.preview || [];
      setPreview(rows);
      setLastAllocated(rows[0]?.last_reset_date || "");
    } catch (err) {
      setPreview([]);
      setError(err.response?.data?.detail || "Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmAllocation = async () => {
    setConfirmOpen(false);
    setAllocating(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/api/admin/entitlements/allocate");
      setSuccess(`✓ Allocation complete! ${data?.processed || 0} cards updated.`);
      await loadPreview({ preserveSuccess: true });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Allocation failed.",
      );
    } finally {
      setAllocating(false);
    }
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold">Entitlement Engine</h1>
      <p className="text-sm text-gray-400 mt-1">
        Preview and allocate monthly rations for all active cards
      </p>

      <div className="flex gap-4 items-center mb-2 mt-6">
        <button
          type="button"
          onClick={loadPreview}
          disabled={previewLoading || allocating}
          className="border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 rounded-lg px-4 py-2 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {previewLoading ? "Loading preview..." : "Preview Allocation"}
        </button>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={allocating || previewLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allocating ? "Allocating..." : "⚡ Allocate Monthly Ration"}
        </button>
      </div>

      {lastAllocated && (
        <p className="text-xs text-gray-400 mb-6">
          Last allocated: {formatLastAllocated(lastAllocated)}
        </p>
      )}

      {success && (
        <div className="bg-green-900/40 border border-green-700 rounded-xl p-4 text-green-300 text-sm mb-4">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {previewVisible && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mt-6">
          {previewLoading ? (
            <div className="text-center text-gray-400 py-10">Loading preview...</div>
          ) : preview.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              No active ration cards found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Card Number</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Family Size</th>
                  <th className="px-4 py-3 text-left">Rice (kg)</th>
                  <th className="px-4 py-3 text-left">Wheat (kg)</th>
                  <th className="px-4 py-3 text-left">Sugar (kg)</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr
                    key={row.ration_card_id}
                    className="border-t border-gray-800 hover:bg-gray-800/50 transition"
                  >
                    <td className="px-4 py-3 text-gray-200">{row.card_number}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getCategoryBadgeClass(
                          row.category,
                        )}`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-200">{row.family_size}</td>
                    <td className="px-4 py-3 text-gray-200">
                      {row.category === "AAY" ? (
                        <span className="text-gray-400 italic">35 (fixed)</span>
                      ) : (
                        row.rice_kg
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-200">{row.wheat_kg}</td>
                    <td className="px-4 py-3 text-gray-200">{row.sugar_kg}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800/50 text-gray-300 text-xs font-medium">
                  <td className="px-4 py-3" colSpan={6}>
                    Total: {totals.cards} cards | {totals.rice.toFixed(2)} kg rice |{" "}
                    {totals.wheat.toFixed(2)} kg wheat |{" "}
                    {totals.sugar.toFixed(2)} kg sugar
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-white mb-2">
              Confirm Monthly Allocation
            </h2>
            <p className="text-sm text-gray-300 mb-4">
              This will reset all wallet balances based on current family sizes
              and policies. This cannot be undone.
            </p>
            <p className="text-sm text-gray-400 mb-5">
              Are you sure? This will reset all wallet balances for this month.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAllocation}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium"
              >
                Confirm Allocation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Entitlements;
