import { useRef, useState } from 'react';
import api from '../../api/axios';

// ─── CSV parser ────────────────────────────────────────────────────────────────
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

function normalizeKey(h) {
  return h.toLowerCase().replace(/[\s\-]+/g, '_').trim();
}

function csvToObjects(text, aliasMap) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { objects: [], unmapped: [] };
  const rawHeaders = rows[0];
  const headerMap = {};
  const unmapped = [];
  rawHeaders.forEach((h, i) => {
    const key = aliasMap[normalizeKey(h)] || null;
    if (key) headerMap[i] = key;
    else unmapped.push(h);
  });
  const objects = rows.slice(1).map((fields) => {
    const obj = {};
    fields.forEach((val, i) => { if (headerMap[i]) obj[headerMap[i]] = val; });
    return obj;
  }).filter((o) => Object.values(o).some((v) => v !== ''));
  return { objects, unmapped };
}

// ─── Head-of-family config ─────────────────────────────────────────────────────
const HEAD_ALIASES = {
  full_name: 'full_name', name: 'full_name', fullname: 'full_name',
  mobile: 'mobile', phone: 'mobile',
  gender: 'gender', sex: 'gender',
  age: 'age',
  area: 'area',
  shop: 'shop', shop_name: 'shop',
  address: 'address', addr: 'address',
  category: 'category', ration_category: 'category',
  family_size: 'family_size', familysize: 'family_size', members: 'family_size', family: 'family_size',
};
const HEAD_COLS     = ['full_name', 'mobile', 'gender', 'age', 'area', 'shop', 'address', 'category', 'family_size'];
const HEAD_REQUIRED = ['full_name', 'mobile', 'age', 'area', 'shop', 'category', 'family_size'];
const HEAD_TEMPLATE_HEADERS = 'full_name,mobile,gender,age,area,shop,address,category,family_size';
const HEAD_TEMPLATE_SAMPLE  = 'Ramesh Kumar,9876543210,Male,35,Dharampeth,Dharampeth Shop 1,123 Main St Nagpur,BPL,4';

function validateHeadRow(row) {
  const errs = [];
  for (const c of HEAD_REQUIRED) if (!row[c]?.trim()) errs.push(`${c} required`);
  if (row.age && isNaN(Number(row.age))) errs.push('age must be a number');
  if (row.age && (Number(row.age) < 18 || Number(row.age) > 100)) errs.push('age 18–100');
  if (row.category && !['APL', 'BPL', 'AAY'].includes(row.category.trim().toUpperCase()))
    errs.push('category: APL/BPL/AAY');
  if (row.family_size && (isNaN(Number(row.family_size)) || Number(row.family_size) < 1))
    errs.push('family_size ≥ 1');
  return errs;
}

// ─── Family-members config ─────────────────────────────────────────────────────
const MEMBER_ALIASES = {
  head_mobile: 'head_mobile', mobile: 'head_mobile', phone: 'head_mobile', head_phone: 'head_mobile',
  member_name: 'member_name', name: 'member_name', full_name: 'member_name', membername: 'member_name',
  gender: 'gender', sex: 'gender',
  age: 'age',
  relationship: 'relationship', relation: 'relationship', relation_with_head: 'relationship',
};
const MEMBER_COLS     = ['head_mobile', 'member_name', 'gender', 'age', 'relationship'];
const MEMBER_REQUIRED = ['head_mobile', 'member_name', 'age'];
const MEMBER_TEMPLATE_HEADERS = 'head_mobile,member_name,gender,age,relationship';
const MEMBER_TEMPLATE_SAMPLE  = [
  '9876543210,Sunita Kumar,Female,32,Spouse',
  '9876543210,Raj Kumar,Male,10,Son',
  '9876543210,Priya Kumar,Female,7,Daughter',
].join('\n');

function validateMemberRow(row) {
  const errs = [];
  for (const c of MEMBER_REQUIRED) if (!row[c]?.trim()) errs.push(`${c} required`);
  if (row.age && isNaN(Number(row.age))) errs.push('age must be a number');
  if (row.age && (Number(row.age) < 0 || Number(row.age) > 120)) errs.push('age 0–120');
  return errs;
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
function downloadTemplate(headers, sample, filename) {
  const content = `${headers}\n${sample}`;
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Reusable UploadPane ────────────────────────────────────────────────────────
const UploadPane = ({
  label, description, templateHeaders, templateSample, templateFile,
  cols, required, aliasMap, validateRow, apiEndpoint, onSuccess,
}) => {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [unmapped, setUnmapped] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [parseError, setParseError] = useState('');

  const resetPane = () => {
    setRows([]); setRowErrors({}); setUnmapped([]);
    setFileName(''); setResults(null); setParseError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(''); setResults(null);
    if (!file.name.endsWith('.csv')) { setParseError('Only .csv files are supported.'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const { objects, unmapped: um } = csvToObjects(evt.target.result, aliasMap);
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
      const res = await api.post(apiEndpoint, { rows });
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

  return (
    <div className="space-y-5">
      {/* Step 1 – Template */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <p className="text-sm font-medium text-gray-200 mb-1">Step 1 — Download the CSV template</p>
        <p className="text-xs text-gray-400 mb-3">
          Required columns:&nbsp;
          <span className="text-blue-400">{required.join(', ')}</span>
        </p>
        <button
          type="button"
          onClick={() => downloadTemplate(templateHeaders, templateSample, templateFile)}
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-4 py-2 transition"
        >
          ↓ Download Template
        </button>
      </div>

      {/* Step 2 – Upload */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <p className="text-sm font-medium text-gray-200 mb-3">Step 2 — Upload your filled CSV</p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-4 py-2 transition">
            <span>📂 Choose CSV file</span>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
          {fileName && <span className="text-xs text-gray-400">{fileName}</span>}
          {(rows.length > 0 || results) && (
            <button
              type="button"
              onClick={resetPane}
              className="text-gray-500 hover:text-gray-300 text-xs underline ml-auto"
            >
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
              <span className="ml-2 text-red-400">
                ({clientErrorCount} with errors — fix in CSV and re-upload)
              </span>
            )}
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-700 max-h-60 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  {cols.map((c) => (
                    <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{c.replace(/_/g, ' ')}</th>
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
                      {cols.map((col) => (
                        <td key={col} className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[140px] truncate">
                          {row[col] || <span className="text-gray-600">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-red-400 whitespace-nowrap">{errs.join('; ') || ''}</td>
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
                  <th className="px-3 py-2 text-left">Name</th>
                  {results.results[0]?.card_number !== undefined && (
                    <th className="px-3 py-2 text-left">Card No.</th>
                  )}
                  {results.results[0]?.head_mobile !== undefined && (
                    <th className="px-3 py-2 text-left">Head Mobile</th>
                  )}
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((r) => (
                  <tr key={r.row} className="border-t border-gray-800">
                    <td className="px-3 py-2 text-gray-500">{r.row}</td>
                    <td className="px-3 py-2 text-gray-300">{r.name}</td>
                    {r.card_number !== undefined && (
                      <td className="px-3 py-2 text-gray-300 font-mono">{r.card_number || '—'}</td>
                    )}
                    {r.head_mobile !== undefined && (
                      <td className="px-3 py-2 text-gray-300">{r.head_mobile}</td>
                    )}
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-red-400 text-xs max-w-[200px] truncate">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload button */}
      {!results && (
        <button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload || uploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg px-5 py-2.5 transition w-full font-medium"
        >
          {uploading
            ? 'Uploading…'
            : rows.length > 0
            ? `Upload ${rows.length} row${rows.length !== 1 ? 's' : ''}`
            : 'Upload'}
        </button>
      )}
    </div>
  );
};

// ─── Main modal ────────────────────────────────────────────────────────────────
const BulkUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState('heads');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-4xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk Upload</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload CSV files to register beneficiaries in bulk</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          <button
            type="button"
            onClick={() => setTab('heads')}
            className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
              tab === 'heads'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Head of Family
          </button>
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`px-6 py-3 text-sm font-medium transition border-b-2 ${
              tab === 'members'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Family Members
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'heads' ? (
            <UploadPane
              key="heads"
              label="Head of Family"
              description="Creates ration card + wallet for each head"
              templateHeaders={HEAD_TEMPLATE_HEADERS}
              templateSample={HEAD_TEMPLATE_SAMPLE}
              templateFile="head_bulk_upload_template.csv"
              cols={HEAD_COLS}
              required={HEAD_REQUIRED}
              aliasMap={HEAD_ALIASES}
              validateRow={validateHeadRow}
              apiEndpoint="/api/admin/ration-cards/bulk"
              onSuccess={onSuccess}
            />
          ) : (
            <UploadPane
              key="members"
              label="Family Members"
              description="Adds members to an existing ration card identified by head's mobile. Wallet is updated automatically."
              templateHeaders={MEMBER_TEMPLATE_HEADERS}
              templateSample={MEMBER_TEMPLATE_SAMPLE}
              templateFile="members_bulk_upload_template.csv"
              cols={MEMBER_COLS}
              required={MEMBER_REQUIRED}
              aliasMap={MEMBER_ALIASES}
              validateRow={validateMemberRow}
              apiEndpoint="/api/admin/family-members/bulk"
              onSuccess={onSuccess}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg px-5 py-2 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
