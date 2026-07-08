import { useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../ui/useToast';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import cx from '../ui/cx';

const COLS = ['name', 'mobile', 'email', 'password', 'status'];
const REQUIRED = ['name', 'mobile', 'email', 'password'];

const ALIASES = {
  full_name: 'name',
  fullname: 'name',
  name: 'name',
  mobile_number: 'mobile',
  mobile: 'mobile',
  phone: 'mobile',
  contact: 'mobile',
  email: 'email',
  password: 'password',
  status: 'status',
  is_active: 'status',
  active: 'status',
};

const TEMPLATE = [
  'full_name,mobile_number,email,password,status',
  'Rajesh Pawar,9876543210,rajesh.pawar@pds.gov,Shopkeeper123!,active',
  'Sunita Kale,+919876543211,sunita.kale@pds.gov,Sunita123!,inactive',
].join('\n');

const normalizeHeader = (value) => value.toLowerCase().replace(/[\s\-]+/g, '_').trim();

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const parsed = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current.trim());
    parsed.push(fields);
  }

  return parsed;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { objects: [], unmapped: [] };

  const headerMap = {};
  const unmapped = [];

  rows[0].forEach((header, index) => {
    const key = ALIASES[normalizeHeader(header)] || null;
    if (key) headerMap[index] = key;
    else unmapped.push(header);
  });

  const objects = rows
    .slice(1)
    .map((fields) => {
      const entry = {};
      fields.forEach((value, index) => {
        if (headerMap[index]) {
          entry[headerMap[index]] = value;
        }
      });
      return entry;
    })
    .filter((entry) => Object.values(entry).some((value) => value !== ''));

  return { objects, unmapped };
}

function validateRow(row) {
  const errors = [];

  for (const column of REQUIRED) {
    if (!row[column]?.trim()) {
      errors.push(`${column} required`);
    }
  }

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
    errors.push('email must be valid');
  }

  const digits = (row.mobile || '').replace(/\D/g, '');
  if (row.mobile && ![10, 12].includes(digits.length)) {
    errors.push('mobile must be 10 digits or start with country code');
  }
  if (digits.length === 12 && !digits.startsWith('91')) {
    errors.push('mobile country code must be 91');
  }

  if (row.password && row.password.trim().length < 6) {
    errors.push('password min 6 characters');
  }

  const normalizedStatus = row.status?.trim().toLowerCase();
  if (normalizedStatus && !['active', 'inactive'].includes(normalizedStatus)) {
    errors.push('status must be active or inactive');
  }

  return errors;
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'shopkeepers_bulk_upload_template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

const ShopkeeperBulkUploadModal = ({ isOpen, onClose, onSuccess }) => {
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
    setRows([]);
    setRowErrors({});
    setUnmapped([]);
    setFileName('');
    setUploading(false);
    setResults(null);
    setParseError('');
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParseError('');
    setResults(null);

    if (!file.name.endsWith('.csv')) {
      setParseError('Only .csv files are supported.');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const { objects, unmapped: ignoredColumns } = csvToObjects(loadEvent.target.result);

      if (objects.length === 0) {
        setParseError('No data rows found. Ensure the CSV has a header row and at least one data row.');
        setRows([]);
        return;
      }

      const errorsByRow = {};
      objects.forEach((row, index) => {
        const rowValidationErrors = validateRow(row);
        if (rowValidationErrors.length > 0) {
          errorsByRow[index] = rowValidationErrors;
        }
      });

      setRows(objects);
      setRowErrors(errorsByRow);
      setUnmapped(ignoredColumns);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!rows.length) return;

    setUploading(true);
    setParseError('');

    try {
      const response = await api.post('/api/admin/shopkeepers/bulk', { rows });
      setResults(response.data);
      if (response.data.succeeded > 0) {
        toast.success(`${response.data.succeeded} shopkeeper(s) uploaded successfully.`);
        onSuccess?.();
      }
      if (response.data.failed > 0) {
        toast.warning(`${response.data.failed} row(s) failed — see details below.`);
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Upload failed. Please try again.';
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
      title="Bulk Upload — Shopkeepers"
      className="max-w-3xl"
      footer={
        <>
          {!results && (
            <Button variant="primary" onClick={handleUpload} disabled={!canUpload || uploading} className="w-full justify-center">
              {uploading ? 'Uploading…' : rows.length > 0 ? `Upload ${rows.length} row${rows.length !== 1 ? 's' : ''}` : 'Upload'}
            </Button>
          )}
        </>
      }
    >
      <p className="-mt-2 mb-4 text-xs text-text-secondary">Upload CSV files to create shopkeeper user accounts in bulk</p>

      <div className="space-y-5">
        <div className="rounded-md border border-border bg-surface-muted p-4">
          <p className="mb-1 text-sm font-medium text-text-primary">Step 1 — Download template</p>
          <p className="mb-3 text-xs text-text-secondary">
            Required: <span className="text-brand-500">full_name, mobile_number, email, password</span>
            {' '}· Optional: status (active/inactive, default active)
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
                    {COLS.map((column) => (
                      <th key={column} className="whitespace-nowrap px-3 py-2 text-left">
                        {column.replace(/_/g, ' ')}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const issues = rowErrors[index] || [];
                    return (
                      <tr key={index} className={cx('border-t border-border', issues.length && 'bg-danger-bg')}>
                        <td className="px-3 py-2 text-text-disabled">{index + 1}</td>
                        {COLS.map((column) => (
                          <td key={column} className="max-w-[160px] truncate whitespace-nowrap px-3 py-2 text-text-secondary">
                            {row[column] || <span className="text-text-disabled">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-danger-text">{issues.join('; ') || ''}</td>
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
                    <th className="px-3 py-2 text-left">Full Name</th>
                    <th className="px-3 py-2 text-left">Mobile</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((result) => (
                    <tr key={result.row} className="border-t border-border">
                      <td className="px-3 py-2 text-text-disabled">{result.row}</td>
                      <td className="px-3 py-2 text-text-secondary">{result.name || '—'}</td>
                      <td className="px-3 py-2 text-text-secondary">{result.mobile || '—'}</td>
                      <td className="px-3 py-2 text-text-secondary">{result.email || '—'}</td>
                      <td className="px-3 py-2">
                        <Badge status={result.status === 'success' ? 'success' : 'danger'}>{result.status}</Badge>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-xs text-danger-text">{result.error || ''}</td>
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

export default ShopkeeperBulkUploadModal;
