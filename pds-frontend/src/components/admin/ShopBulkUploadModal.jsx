import { useRef, useState } from 'react';
import api from '../../api/axios';

const COLS     = ['shop_code', 'shop_name', 'area', 'contact_number', 'shopkeeper_email', 'status'];
const REQUIRED = ['shop_code', 'shop_name', 'area'];

const ALIASES = {
  shop_code: 'shop_code', code: 'shop_code', shopcode: 'shop_code',
  shop_name: 'shop_name', name: 'shop_name', shopname: 'shop_name',
  area: 'area', area_name: 'area',
  contact_number: 'contact_number', contact: 'contact_number', phone: 'contact_number', mobile: 'contact_number',
  shopkeeper_email: 'shopkeeper_email', shopkeeper: 'shopkeeper_email', email: 'shopkeeper_email',
  status: 'status', is_active: 'status', active: 'status',
};

const TEMPLATE = [
  'shop_code,shop_name,area,contact_number,shopkeeper_email,status',
  'DHR-001,Dharampeth Shop 1,Dharampeth,9876500001,shopkeeper@pds.gov,active',
  'DHR-002,Dharampeth Shop 2,Dharampeth,9876500002,,active',
  'NGP-001,Nagpur Central Shop 1,Nagpur Central,,,inactive',
].join('\n');

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const parsed = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let cur = '';
    let inQ = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQ && line[j + 1] === '"') { cur += '"'; j++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    fields.push(cur.trim());
    parsed.push(fields);
  }
  return parsed;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { objects: [], unmapped: [] };
  const rawHeaders = rows[0];
  const headerMap = {};
  const unmapped = [];
  rawHeaders.forEach((h, i) => {
    const key = ALIASES[h.toLowerCase().replace(/[\s\-]+/g, '_').trim()] || null;
    if (key) headerMap[i] = key;
    else unmapped.push(h);
  });
  const objects = rows.slice(1)
    .map((fields) => {
      const obj = {};
      fields.forEach((val, i) => { if (headerMap[i]) obj[headerMap[i]] = val; });
      return obj;
    })
    .filter((o) => Object.values(o).some((v) => v !== ''));
  return { objects, unmapped };
}

function validateRow(row) {
  const errs = [];
  for (const c of REQUIRED) if (!row[c]?.trim()) errs.push(`${c} required`);
  const s = row.status?.trim().toLowerCase();
  if (s && !['active', 'inactive', ''].includes(s)) errs.push('status must be active or inactive');
  return errs;
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'shops_bulk_upload_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

const ShopBulkUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [unmapped, setUnmapped] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setRows([]); setRowErrors({}); setUnmapped([]);
    setFileName(''); setResults(null); setParseError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(''); setResults(null);
    if (!file.name.endsWith('.csv')) { setParseError('Only .csv files are supported.'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const { objects, unmapped: um } = csvToObjects(evt.target.result);
      if (objects.length === 0) {
        setParseError('No data rows found. Ensure the file has a header row and at least one data row.');
        setRows([]); return;
      }
      const errs = {};
      objects.forEach((row, i) => { const e = validateRow(row); if (e.length) errs[i] = e; });
      setRows(objects); setRowErrors(errs); setUnmapped(um);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!rows.length) return;
    setUploading(true);
    try {
      const res = await api.post('/api/admin/shops/bulk', { rows });
      setResults(res.data);
      if (res.data.succeeded > 0) onSuccess?.();
    } catch (err) {
      setParseError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const clientErrorCount = Object.keys(rowErrors).length;
  const canUpload = rows.length > 0 && clientErrorCount === 0 && !results;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk Upload — Shops</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Required columns: <span className="text-blue-400">shop_code, shop_name, area</span>
            </p>
          </div>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Step 1 */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-sm font-medium text-gray-200 mb-1">Step 1 — Download template</p>
            <p className="text-xs text-gray-400 mb-3">
              Required: <span className="text-blue-400">shop_code, shop_name, area</span> &nbsp;·&nbsp;
              Optional: contact_number, shopkeeper_email, status (active/inactive — default active).
              Area name must match an existing active area (case-insensitive).
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-4 py-2 transition"
            >
              ↓ Download Template
            </button>
          </div>

          {/* Step 2 */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-sm font-medium text-gray-200 mb-3">Step 2 — Upload your filled CSV</p>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-4 py-2 transition">
                <span>📂 Choose CSV file</span>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </label>
              {fileName && <span className="text-xs text-gray-400">{fileName}</span>}
              {(rows.length > 0 || results) && (
                <button type="button" onClick={reset} className="text-gray-500 hover:text-gray-300 text-xs underline ml-auto">
                  Clear
                </button>
              )}
            </div>
          </div>

          {parseError && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-red-300 text-sm">
              {parseError}
            </div>
          )}

          {unmapped.length > 0 && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-3 text-yellow-300 text-xs">
              Unknown columns ignored: {unmapped.join(', ')}
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && !results && (
            <div>
              <p className="text-sm font-medium text-gray-200 mb-2">
                Preview — {rows.length} row{rows.length !== 1 ? 's' : ''}
                {clientErrorCount > 0 && (
                  <span className="ml-2 text-red-400">({clientErrorCount} with errors)</span>
                )}
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      {COLS.map((c) => (
                        <th key={c} className="px-3 py-2 text-left">{c.replace(/_/g, ' ')}</th>
                      ))}
                      <th className="px-3 py-2 text-left">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const errs = rowErrors[i] || [];
                      return (
                        <tr key={i} className={`border-t border-gray-800 ${errs.length ? 'bg-red-900/20' : ''}`}>
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          {COLS.map((col) => (
                            <td key={col} className="px-3 py-2 text-gray-300 whitespace-nowrap">
                              {row[col] || <span className="text-gray-600">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-red-400">{errs.join('; ') || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div>
              <div className="flex gap-3 mb-3">
                <div className="bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-green-400">{results.succeeded}</p>
                  <p className="text-xs text-green-300 mt-0.5">Created</p>
                </div>
                <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-red-400">{results.failed}</p>
                  <p className="text-xs text-red-300 mt-0.5">Failed</p>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-white">{results.total}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Total</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Shop Code</th>
                      <th className="px-3 py-2 text-left">Shop Name</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((r) => (
                      <tr key={r.row} className="border-t border-gray-800">
                        <td className="px-3 py-2 text-gray-500">{r.row}</td>
                        <td className="px-3 py-2 text-gray-300 font-mono">{r.shop_code}</td>
                        <td className="px-3 py-2 text-gray-300">{r.shop_name}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-red-400">{r.error || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
          {results ? (
            <button
              type="button"
              onClick={handleClose}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg px-5 py-2 transition"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg px-5 py-2 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload || uploading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg px-5 py-2 transition"
              >
                {uploading ? 'Uploading…' : rows.length > 0 ? `Upload ${rows.length} shops` : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopBulkUploadModal;
