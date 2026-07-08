import { useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../ui/useToast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import cx from '../ui/cx';

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
  templateHeaders, templateSample, templateFile,
  cols, required, aliasMap, validateRow, apiEndpoint, onSuccess,
}) => {
  const toast = useToast();
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
      if (res.data.succeeded > 0) {
        toast.success(`${res.data.succeeded} row(s) uploaded successfully.`);
        onSuccess?.();
      }
      if (res.data.failed > 0) {
        toast.warning(`${res.data.failed} row(s) failed — see details below.`);
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Upload failed. Please try again.';
      setParseError(message);
      toast.danger(message);
    } finally {
      setUploading(false);
    }
  };

  const clientErrorCount = Object.keys(rowErrors).length;
  const canUpload = rows.length > 0 && clientErrorCount === 0 && !results;

  return (
    <div className="space-y-5">
      {/* Step 1 – Template */}
      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="mb-1 text-sm font-medium text-text-primary">Step 1 — Download the CSV template</p>
        <p className="mb-3 text-xs text-text-secondary">
          Required columns:&nbsp;
          <span className="text-brand-500">{required.join(', ')}</span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => downloadTemplate(templateHeaders, templateSample, templateFile)}>
          <Download size={14} />
          Download Template
        </Button>
      </div>

      {/* Step 2 – Upload */}
      <div className="rounded-md border border-border bg-surface-muted p-4">
        <p className="mb-3 text-sm font-medium text-text-primary">Step 2 — Upload your filled CSV</p>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-surface border border-border px-4 py-2 text-sm text-text-primary transition hover:bg-surface-muted">
            <FileUp size={14} />
            Choose CSV file
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
          {fileName && <span className="text-xs text-text-secondary">{fileName}</span>}
          {(rows.length > 0 || results) && (
            <button
              type="button"
              onClick={resetPane}
              className="ml-auto rounded-sm text-xs text-text-secondary underline hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {parseError && (
        <div className="rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          {parseError}
        </div>
      )}

      {unmapped.length > 0 && (
        <div className="rounded-sm border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text">
          Unknown columns ignored: {unmapped.join(', ')}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && !results && (
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">
            Preview — {rows.length} row{rows.length !== 1 ? 's' : ''}
            {clientErrorCount > 0 && (
              <span className="ml-2 text-danger-text">
                ({clientErrorCount} with errors — fix in CSV and re-upload)
              </span>
            )}
          </p>
          <div className="max-h-60 overflow-x-auto overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-muted uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  {cols.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left">{c.replace(/_/g, ' ')}</th>
                  ))}
                  <th className="px-3 py-2 text-left">Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const errs = rowErrors[i] || [];
                  return (
                    <tr key={i} className={cx('border-t border-border', errs.length && 'bg-danger-bg')}>
                      <td className="px-3 py-2 text-text-disabled">{i + 1}</td>
                      {cols.map((col) => (
                        <td key={col} className="max-w-[140px] truncate whitespace-nowrap px-3 py-2 text-text-secondary">
                          {row[col] || <span className="text-text-disabled">—</span>}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-danger-text">{errs.join('; ') || ''}</td>
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
          <div className="mb-3 flex gap-3">
            <div className="flex-1 rounded-md border border-success-border bg-success-bg px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-success-text">{results.succeeded}</p>
              <p className="mt-0.5 text-xs text-success-text">Created</p>
            </div>
            <div className="flex-1 rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-danger-text">{results.failed}</p>
              <p className="mt-0.5 text-xs text-danger-text">Failed</p>
            </div>
            <div className="flex-1 rounded-md border border-border bg-surface-muted px-4 py-3 text-center">
              <p className="text-2xl font-bold tabular-nums text-text-primary">{results.total}</p>
              <p className="mt-0.5 text-xs text-text-secondary">Total</p>
            </div>
          </div>
          <div className="max-h-56 overflow-x-auto overflow-y-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-muted uppercase tracking-wider text-text-secondary">
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
                  <tr key={r.row} className="border-t border-border">
                    <td className="px-3 py-2 text-text-disabled">{r.row}</td>
                    <td className="px-3 py-2 text-text-secondary">{r.name}</td>
                    {r.card_number !== undefined && (
                      <td className="px-3 py-2 font-mono text-text-secondary">{r.card_number || '—'}</td>
                    )}
                    {r.head_mobile !== undefined && (
                      <td className="px-3 py-2 text-text-secondary">{r.head_mobile}</td>
                    )}
                    <td className="px-3 py-2">
                      <Badge status={r.status === 'success' ? 'success' : 'danger'}>{r.status}</Badge>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-danger-text">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload button */}
      {!results && (
        <Button variant="primary" onClick={handleUpload} disabled={!canUpload || uploading} className="w-full justify-center">
          {uploading
            ? 'Uploading…'
            : rows.length > 0
            ? `Upload ${rows.length} row${rows.length !== 1 ? 's' : ''}`
            : 'Upload'}
        </Button>
      )}
    </div>
  );
};

// ─── Main modal ────────────────────────────────────────────────────────────────
const BulkUploadModal = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState('heads');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload" className="max-w-4xl">
      <p className="-mt-2 mb-4 text-xs text-text-secondary">Upload CSV files to register beneficiaries in bulk</p>

      <div className="mb-5 flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab('heads')}
          className={cx(
            'border-b-2 px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            tab === 'heads' ? 'border-brand-500 text-brand-500' : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          Head of Family
        </button>
        <button
          type="button"
          onClick={() => setTab('members')}
          className={cx(
            'border-b-2 px-4 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            tab === 'members' ? 'border-brand-500 text-brand-500' : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          Family Members
        </button>
      </div>

      {tab === 'heads' ? (
        <UploadPane
          key="heads"
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
    </Modal>
  );
};

export default BulkUploadModal;
