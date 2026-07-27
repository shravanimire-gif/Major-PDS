// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses when running under vitest's own internal Vite.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import DonutChart from './DonutChart';

afterEach(() => {
  cleanup();
});

const CATEGORY_DATA = [
  { label: 'APL', value: 40 },
  { label: 'BPL', value: 35 },
  { label: 'AAY', value: 25 },
];

describe('DonutChart', () => {
  it('renders every slice label, value, and computed percentage in the legend', () => {
    render(<DonutChart data={CATEGORY_DATA} />);
    expect(screen.getByText('APL')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('BPL')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('shows the total and its caption in the center', () => {
    render(<DonutChart data={CATEGORY_DATA} totalLabel="Beneficiaries" />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Beneficiaries')).toBeInTheDocument();
  });

  it('renders a "no data yet" placeholder instead of an empty ring when every value is zero', () => {
    render(<DonutChart data={[{ label: 'APL', value: 0 }]} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('renders plain rows (no buttons) when onSliceClick is not provided', () => {
    render(<DonutChart data={CATEGORY_DATA} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders each non-Other slice as a button and calls onSliceClick with its data', () => {
    const onSliceClick = vi.fn();
    render(<DonutChart data={CATEGORY_DATA} onSliceClick={onSliceClick} />);
    fireEvent.click(screen.getByRole('button', { name: /APL/ }));
    expect(onSliceClick).toHaveBeenCalledTimes(1);
    expect(onSliceClick).toHaveBeenCalledWith(expect.objectContaining({ label: 'APL', value: 40, percentage: 40 }));
  });

  it('never renders the folded "Other" slice as a clickable button', () => {
    const onSliceClick = vi.fn();
    render(
      <DonutChart
        data={[...CATEGORY_DATA.slice(0, 2), { label: 'Other', value: 10, isOther: true }]}
        onSliceClick={onSliceClick}
      />
    );
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Other/ })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<DonutChart data={CATEGORY_DATA} totalLabel="Beneficiaries" onSliceClick={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
