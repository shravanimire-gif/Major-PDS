import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import HashValue from './HashValue';

const { mockToastSuccess } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
}));

vi.mock('../../components/ui/useToast', () => ({
  default: () => ({
    success: mockToastSuccess,
    warning: vi.fn(),
    danger: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  mockToastSuccess.mockClear();
});

describe('HashValue', () => {
  it('renders the truncated value as the visible text', () => {
    render(<HashValue value={ADDRESS} />);
    expect(screen.getByText('0x1234…5678')).toBeInTheDocument();
  });

  it('renders the full untruncated value inside the Tooltip content', async () => {
    render(<HashValue value={ADDRESS} />);
    const trigger = screen.getByText('0x1234…5678');
    fireEvent.focus(trigger);
    // Tooltip delays showing behind a short timer (OPEN_DELAY_MS) — wait for
    // it rather than asserting immediately after the focus event.
    expect(await screen.findByRole('tooltip')).toHaveTextContent(ADDRESS);
  });

  it('renders a plain span (no button) when copyable is false', () => {
    render(<HashValue value={ADDRESS} copyable={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('0x1234…5678').tagName).toBe('SPAN');
  });

  it('renders a clickable button by default', () => {
    render(<HashValue value={ADDRESS} />);
    expect(screen.getByRole('button', { name: '0x1234…5678' })).toBeInTheDocument();
  });

  it('copies the full value and shows a success toast when clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<HashValue value={ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: '0x1234…5678' }));

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(ADDRESS);
    });
    await vi.waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Copied to clipboard');
    });
  });

  it('does not show a toast when the copy fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    render(<HashValue value={ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: '0x1234…5678' }));

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(ADDRESS);
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<HashValue value={ADDRESS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
