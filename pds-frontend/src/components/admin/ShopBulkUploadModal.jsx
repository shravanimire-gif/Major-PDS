import { useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../ui/useToast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import cx from '../ui/cx';

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
  const toast = useToast();
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
      if (res.data.succeeded > 0) {
        toast.success(`${res.data.succeeded} shop(s) uploaded successfully.`);
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
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Upload — Shops"
      className="max-w-3xl"
      footer={
        results ? (
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpload} disabled={!canUpload || uploading}>
              {uploading ? 'Uploading…' : rows.length > 0 ? `Upload ${rows.length} shops` : 'Upload'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <p className="mb-1 text-sm font-medium text-text-primary">Step 1 — Download template</p>
          <p className="mb-3 text-xs text-text-secondary">
            Required: <span className="text-brand-500">shop_code, shop_name, area</span> &nbsp;·&nbsp;
            Optional: contact_number, shopkeeper_email, status (active/inactive — default active).
            Area name must match an existing active area (case-insensitive).
          </p>
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            <Download size={14} />
            Download Template
          </Button>
        </div>

        <div className="rounded-md border border-border bg-surface-muted p-4">
          <p className="mb-3 text-sm font-medium text-text-primary">Step 2 — Upload your filled CSV</p>
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2 text-sm text-text-primary transition hover:bg-surface-muted">
              <FileUp size={14} />
              Choose CSV file
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            </label>
            {fileName && <span className="text-xs text-text-secondary">{fileName}</span>}
            {(rows.length > 0 || results) && (
              <button
                type="button"
                onClick={reset}
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

        {rows.length > 0 && !results && (
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">
              Preview — {rows.length} row{rows.length !== 1 ? 's' : ''}
              {clientErrorCount > 0 && <span className="ml-2 text-danger-text">({clientErrorCount} with errors)</span>}
            </p>
            <div className="max-h-60 overflow-x-auto overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-muted uppercase tracking-wider text-text-secondary">
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
                      <tr key={i} className={cx('border-t border-border', errs.length && 'bg-danger-bg')}>
                        <td className="px-3 py-2 text-text-disabled">{i + 1}</td>
                        {COLS.map((col) => (
                          <td key={col} className="whitespace-nowrap px-3 py-2 text-text-secondary">
                            {row[col] || <span className="text-text-disabled">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-danger-text">{errs.join('; ') || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                    <th className="px-3 py-2 text-left">Shop Code</th>
                    <th className="px-3 py-2 text-left">Shop Name</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r) => (
                    <tr key={r.row} className="border-t border-border">
                      <td className="px-3 py-2 text-text-disabled">{r.row}</td>
                      <td className="px-3 py-2 font-mono text-text-secondary">{r.shop_code}</td>
                      <td className="px-3 py-2 text-text-secondary">{r.shop_name}</td>
                      <td className="px-3 py-2">
                        <Badge status={r.status === 'success' ? 'success' : 'danger'}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-danger-text">{r.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ShopBulkUploadModal;
