import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// api/axios reads import.meta.env and window.location at module scope and
// attaches interceptors, so it is mocked wholesale rather than intercepted —
// what is under test here is the page's behaviour, not the HTTP client.
vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  resolvedApiBaseUrl: '',
}));

// The page's only use of the toast context; stubbing it keeps the test from
// needing a ToastProvider wrapper for behaviour it does not assert.
const toast = { success: vi.fn(), danger: vi.fn(), warning: vi.fn() };
vi.mock('../../components/ui/useToast', () => ({ default: () => toast }));

import api from '../../api/axios';
import Devices from './Devices';

const SHOP_ID = '148bf4bf-2817-4d6b-8be5-0a4cca73dbdc';

const onlineDevice = {
  id: 'row-1',
  device_id: 'ESP32-A1B2C3',
  device_name: 'Dharampeth 1 — counter scale',
  shop_id: SHOP_ID,
  shop_name: 'Dharampeth Fair Price Shop 1',
  shop_code: 'DHR-001',
  shopkeeper_name: 'Ajay Wankhede',
  shopkeeper_email: 'ajay.wankhede@pds.gov',
  status: 'active',
  connectivity: 'online',
  firmware_version: '2.0.0-serial',
  last_seen_at: '2026-08-18T10:00:00.000Z',
  created_at: '2026-08-01T10:00:00.000Z',
  needs_recalibration: false,
  current_weight_grams: 2478,
  current_weight_at: '2026-08-18T10:00:00.000Z',
};

const offlineUnassignedDevice = {
  id: 'row-2',
  device_id: 'ESP32-DEAD01',
  device_name: null,
  shop_id: null,
  shop_name: null,
  shop_code: null,
  shopkeeper_name: null,
  shopkeeper_email: null,
  status: 'inactive',
  connectivity: 'offline',
  firmware_version: null,
  last_seen_at: null,
  created_at: '2026-08-02T10:00:00.000Z',
  needs_recalibration: true,
  current_weight_grams: null,
  current_weight_at: null,
};

const mockApi = ({ devices = [], shops = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/api/admin/iot/devices') return Promise.resolve({ data: { devices } });
    if (url === '/api/admin/shops') return Promise.resolve({ data: { shops } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
};

const SHOPS = [
  { id: SHOP_ID, shop_name: 'Dharampeth Fair Price Shop 1', shop_code: 'DHR-001', is_active: true },
  { id: 'shop-2', shop_name: 'Manewada Fair Price Shop 1', shop_code: 'MNW-001', is_active: true },
  { id: 'shop-3', shop_name: 'Closed Shop', shop_code: 'CLS-001', is_active: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.patch.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: { device: { device_id: 'ESP32-NEW001' }, token: 'raw-token-value' } });
});

afterEach(() => {
  cleanup();
});

describe('Admin > Devices — device list', () => {
  it('renders the registry columns for a connected, assigned device', async () => {
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);

    expect(await screen.findByText('ESP32-A1B2C3')).toBeInTheDocument();
    expect(screen.getByText('Dharampeth 1 — counter scale')).toBeInTheDocument();
    expect(screen.getByText('Dharampeth Fair Price Shop 1')).toBeInTheDocument();
    expect(screen.getByText('DHR-001')).toBeInTheDocument();
    expect(screen.getByText('Ajay Wankhede')).toBeInTheDocument();
    expect(screen.getByText('ajay.wankhede@pds.gov')).toBeInTheDocument();
    expect(screen.getByText('2.0.0-serial')).toBeInTheDocument();
  });

  it('shows an empty state that explains how to obtain a device UID', async () => {
    mockApi({ devices: [], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText(/No devices registered yet/)).toBeInTheDocument();
  });

  it('lists an unassigned device rather than hiding it', async () => {
    // The unassigned device is exactly the one an admin came here to assign, so
    // it must not be filtered out by the shop join.
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);

    expect(await screen.findByText('ESP32-DEAD01')).toBeInTheDocument();
    // "Unassigned" is also a summary-tile label, so count both occurrences
    // rather than asserting on a single ambiguous match.
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Admin > Devices — status is connectivity, not existence', () => {
  it('shows Online only when a bridge is actually connected', async () => {
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText('Online')).toBeInTheDocument();
  });

  it('shows Offline for a registered device with no live connection', async () => {
    // The row exists and is perfectly healthy in PostgreSQL; that is not a
    // reason to claim the scale is reachable.
    mockApi({ devices: [{ ...onlineDevice, connectivity: 'offline' }], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText('Offline')).toBeInTheDocument();
    expect(screen.queryByText('Online')).not.toBeInTheDocument();
  });

  it('shows Stale distinctly from Online and Offline', async () => {
    mockApi({ devices: [{ ...onlineDevice, connectivity: 'stale' }], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText('Stale')).toBeInTheDocument();
  });

  it('reports lifecycle status alongside connectivity, never merged into it', async () => {
    mockApi({
      devices: [{ ...onlineDevice, status: 'inactive', connectivity: 'offline' }],
      shops: SHOPS,
    });
    render(<Devices />);
    expect(await screen.findByText('Disabled')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('flags a device that needs recalibration', async () => {
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText('Needs recalibration')).toBeInTheDocument();
  });

  it('shows Never for a device that has never connected', async () => {
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText('Never')).toBeInTheDocument();
  });
});

describe('Admin > Devices — current weight is a sensor reading', () => {
  it('displays the latest reading in grams', async () => {
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);
    expect(await screen.findByText('2,478 g')).toBeInTheDocument();
  });

  it('labels a live reading as not being a dispense', async () => {
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);
    const weight = await screen.findByText('2,478 g');
    expect(weight.getAttribute('title')).toMatch(/not a dispense/i);
  });

  it('marks a reading from a disconnected device as last-known, not live', async () => {
    mockApi({ devices: [{ ...onlineDevice, connectivity: 'offline' }], shops: SHOPS });
    render(<Devices />);
    const weight = await screen.findByText('2,478 g');
    expect(weight.getAttribute('title')).toMatch(/last known/i);
  });

  it('shows a dash when the device has never reported a reading', async () => {
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);
    await screen.findByText('ESP32-DEAD01');
    // Explicitly absent rather than rendered as "0 g", which would look like an
    // empty pan on a working scale.
    expect(screen.queryByText('0 g')).not.toBeInTheDocument();
  });

  it('states in the page that a reading is not a dispense', async () => {
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);
    expect(
      await screen.findByText(/only an authorised dispense session creates a transaction/i),
    ).toBeInTheDocument();
  });
});

describe('Admin > Devices — assignment', () => {
  it('offers only active shops for assignment', async () => {
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Assign/i }));

    expect(await screen.findByRole('option', { name: /Dharampeth Fair Price Shop 1/ })).toBeInTheDocument();
    // An inactive shop is rejected by the backend, so offering it would only
    // produce an error the admin cannot act on.
    expect(screen.queryByRole('option', { name: /Closed Shop/ })).not.toBeInTheDocument();
  });

  it('assigns a device to the selected shop', async () => {
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Assign/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(await screen.findByLabelText('Shop'), SHOP_ID);
    // Scoped to the dialog: the row action button is also named "Assign".
    await userEvent.click(within(dialog).getByRole('button', { name: /^Assign$/ }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/admin/iot/devices/ESP32-DEAD01/assignment', {
        shop_id: SHOP_ID,
      }),
    );
  });

  it('unassigns by sending an explicit null shop_id', async () => {
    // null is the unassign signal; an omitted field would make "unassign" and
    // "malformed request" indistinguishable to the backend.
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Reassign/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(await screen.findByLabelText('Shop'), '');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Unassign$/ }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/admin/iot/devices/ESP32-A1B2C3/assignment', {
        shop_id: null,
      }),
    );
  });

  it('surfaces a backend refusal (e.g. mid-dispense) instead of appearing to succeed', async () => {
    api.patch.mockRejectedValue({
      response: { data: { error: 'Device is mid-dispense (session abc is weighing).' } },
    });
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Reassign/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Assign$/ }));

    await waitFor(() => expect(toast.danger).toHaveBeenCalledWith(expect.stringMatching(/mid-dispense/)));
  });
});

describe('Admin > Devices — enable / disable', () => {
  it('disables an active device', async () => {
    mockApi({ devices: [onlineDevice], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Disable/i }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/admin/iot/devices/ESP32-A1B2C3/status', {
        status: 'inactive',
      }),
    );
  });

  it('enables a disabled device', async () => {
    mockApi({ devices: [offlineUnassignedDevice], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Enable/i }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/admin/iot/devices/ESP32-DEAD01/status', {
        status: 'active',
      }),
    );
  });
});

describe('Admin > Devices — registration', () => {
  it('registers a device UID without requiring a shop', async () => {
    mockApi({ devices: [], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Register Device/i }));
    await userEvent.type(screen.getByLabelText(/Device UID/), 'ESP32-NEW001');
    await userEvent.click(screen.getByRole('button', { name: /^Register$/ }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/iot/devices', {
        device_id: 'ESP32-NEW001',
        device_name: undefined,
        shop_id: undefined,
      }),
    );
  });

  it('shows the issued token once, with a warning that it cannot be recovered', async () => {
    mockApi({ devices: [], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Register Device/i }));
    await userEvent.type(screen.getByLabelText(/Device UID/), 'ESP32-NEW001');
    await userEvent.click(screen.getByRole('button', { name: /^Register$/ }));

    expect(await screen.findByText('raw-token-value')).toBeInTheDocument();
    expect(screen.getByText(/Shown once/i)).toBeInTheDocument();
    // The token belongs in the bridge's environment, not compiled into firmware.
    expect(screen.getByText(/IOT_DEVICE_TOKEN/)).toBeInTheDocument();
  });

  it('reports a duplicate UID instead of silently failing', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'device_id already registered' } } });
    mockApi({ devices: [], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Register Device/i }));
    await userEvent.type(screen.getByLabelText(/Device UID/), 'ESP32-A1B2C3');
    await userEvent.click(screen.getByRole('button', { name: /^Register$/ }));

    expect(await screen.findByText('device_id already registered')).toBeInTheDocument();
  });

  it('keeps input focus while a full device UID is typed', async () => {
    // Regression guard for the Modal focus-trap bug: the trap effect used to
    // depend on the inline `onClose` identity, so it re-ran on every keystroke
    // and moved focus to the panel's first control — "ESP32-A1B2C3" arrived as
    // "E". Registering a device would then create a row with a truncated UID
    // that no board could ever authenticate as.
    mockApi({ devices: [], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Register Device/i }));
    const uidInput = screen.getByLabelText(/Device UID/);
    await userEvent.type(uidInput, 'ESP32-A1B2C3');
    expect(uidInput).toHaveValue('ESP32-A1B2C3');
  });

  it('tells the admin that a UID is not a COM port', async () => {
    mockApi({ devices: [], shops: SHOPS });
    render(<Devices />);

    await userEvent.click(await screen.findByRole('button', { name: /Register Device/i }));
    expect(await screen.findByText(/Never a COM port/i)).toBeInTheDocument();
  });
});
