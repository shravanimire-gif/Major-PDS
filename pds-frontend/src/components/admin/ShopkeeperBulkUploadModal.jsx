import { useRef, useState } from 'react';
import api from '../../api/axios';

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
        onSuccess?.();
      }
    } catch (error) {
      setParseError(error.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const clientErrorCount = Object.keys(rowErrors).length;
  const canUpload = rows.length > 0 && clientErrorCount === 0 && !results;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Bulk Upload — Shopkeepers</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Upload CSV files to create shopkeeper user accounts in bulk
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-sm font-medium text-gray-200 mb-1">Step 1 — Download template</p>
            <p className="text-xs text-gray-400 mb-3">
              Required: <span className="text-blue-400">full_name, mobile_number, email, password</span>
              {' '}· Optional: status (active/inactive, default active)
            </p>
            <button
              type="button"
              onClick={downloadTemplate}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg px-4 py-2 transition"
            >
              ↓ Download Template
            </button>
          </div>

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
                  onClick={reset}
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
                      {COLS.map((column) => (
                        <th key={column} className="px-3 py-2 text-left whitespace-nowrap">
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
                        <tr
                          key={index}
                          className={`border-t border-gray-800 ${issues.length ? 'bg-red-900/20' : ''}`}
                        >
                          <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                          {COLS.map((column) => (
                            <td
                              key={column}
                              className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[160px] truncate"
                            >
                              {row[column] || <span className="text-gray-600">—</span>}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-red-400">{issues.join('; ') || ''}</td>
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
                      <th className="px-3 py-2 text-left">Full Name</th>
                      <th className="px-3 py-2 text-left">Mobile</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.map((result) => (
                      <tr key={result.row} className="border-t border-gray-800">
                        <td className="px-3 py-2 text-gray-500">{result.row}</td>
                        <td className="px-3 py-2 text-gray-300">{result.name || '—'}</td>
                        <td className="px-3 py-2 text-gray-300">{result.mobile || '—'}</td>
                        <td className="px-3 py-2 text-gray-300">{result.email || '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              result.status === 'success'
                                ? 'bg-green-900 text-green-300'
                                : 'bg-red-900 text-red-300'
                            }`}
                          >
                            {result.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-red-400 text-xs max-w-[220px] truncate">
                          {result.error || ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 shrink-0 space-y-2">
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
          <button
            type="button"
            onClick={handleClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg px-5 py-2 transition w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShopkeeperBulkUploadModal;
