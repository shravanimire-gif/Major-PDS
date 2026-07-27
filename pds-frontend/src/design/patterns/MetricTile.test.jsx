// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses when running under vitest's own internal Vite.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import MetricTile from './MetricTile';

afterEach(() => {
  cleanup();
});

describe('MetricTile', () => {
  it('renders label, value, and comparison when provided', () => {
    render(<MetricTile label="Active Shops" value={128} comparison="+12 vs yesterday" />);
    expect(screen.getByText('Active Shops')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('+12 vs yesterday')).toBeInTheDocument();
  });

  it('omits comparison text when not provided', () => {
    render(<MetricTile label="Active Shops" value={128} />);
    expect(screen.queryByText(/vs yesterday/)).not.toBeInTheDocument();
  });

  it('applies the neutral tone color by default', () => {
    render(<MetricTile label="Total" value="42" />);
    expect(screen.getByText('42')).toHaveClass('text-ds-text-primary');
  });

  it('applies the success tone color to the value', () => {
    render(<MetricTile label="Uptime" value="99.9%" tone="success" />);
    expect(screen.getByText('99.9%')).toHaveClass('text-ds-success');
  });

  it('applies the warning tone color to the value', () => {
    render(<MetricTile label="Pending" value="3" tone="warning" comparison="3 pending" />);
    expect(screen.getByText('3')).toHaveClass('text-ds-warning');
  });

  it('applies the danger tone color to the value', () => {
    render(<MetricTile label="Offline Devices" value="5" tone="danger" />);
    expect(screen.getByText('5')).toHaveClass('text-ds-danger');
  });

  it('renders the value with tabular-nums regardless of tone', () => {
    render(<MetricTile label="Total" value="1,024" tone="danger" />);
    expect(screen.getByText('1,024')).toHaveClass('tabular-nums');
  });

  it('renders as a plain, non-interactive container when onClick is not provided', () => {
    render(<MetricTile label="Anomalies" value="0" comparison="no change in 24h" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders as a button and calls onClick when provided', () => {
    const onClick = vi.fn();
    render(<MetricTile label="Anomalies" value="7" onClick={onClick} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the focus-visible ring classes on the clickable variant', () => {
    render(<MetricTile label="Anomalies" value="7" onClick={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('focus-visible:ring-2');
    expect(button).toHaveClass('focus-visible:ring-ds-accent');
  });

  it('has no accessibility violations in the static variant', async () => {
    const { container } = render(
      <MetricTile label="Active Shops" value={128} comparison="+12 vs yesterday" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations in the clickable variant', async () => {
    const { container } = render(
      <MetricTile label="Open Anomalies" value={7} tone="warning" onClick={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
