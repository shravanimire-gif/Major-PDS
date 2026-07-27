// eslint-disable-next-line no-unused-vars -- required in scope: this project's JSX transform is classic (React.createElement), not automatic
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import Table from './Table';

// This project's vitest setup does not register RTL's automatic afterEach
// cleanup, so each test file does it explicitly to avoid DOM from previous
// tests leaking into later queries.
afterEach(() => {
  cleanup();
});

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'amount', header: 'Amount', numeric: true },
];

const data = [
  { id: 1, name: 'Alpha', amount: 10 },
  { id: 2, name: 'Beta', amount: 20 },
  { id: 3, name: 'Gamma', amount: 30 },
];

const getRowKey = (row) => row.id;

describe('Table', () => {
  it('renders column headers and row cells', () => {
    render(<Table columns={columns} data={data} getRowKey={getRowKey} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4); // header + 3 data rows
  });

  it('uses column.render when provided instead of row[key]', () => {
    const renderColumns = [
      { key: 'name', header: 'Name' },
      { key: 'amount', header: 'Amount', numeric: true, render: (row) => `$${row.amount}.00` },
    ];
    render(<Table columns={renderColumns} data={data} getRowKey={getRowKey} />);
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });

  it('right-aligns numeric and align:"right" columns in both header and cells', () => {
    render(<Table columns={columns} data={data} getRowKey={getRowKey} />);
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass('text-right');
    expect(screen.getByText('10')).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByRole('columnheader', { name: 'Name' })).not.toHaveClass('text-right');
  });

  it('applies zebra striping to alternating rows when zebra is true', () => {
    render(<Table columns={columns} data={data} getRowKey={getRowKey} zebra />);
    const rows = screen.getAllByRole('row').slice(1); // drop header row
    expect(rows[0]).toHaveClass('bg-ds-surface');
    expect(rows[1]).toHaveClass('bg-ds-surface-alt');
    expect(rows[2]).toHaveClass('bg-ds-surface');
  });

  it('applies sticky positioning classes to header cells when sticky is true', () => {
    render(<Table columns={columns} data={data} getRowKey={getRowKey} sticky />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveClass('sticky', 'top-0', 'z-10', 'bg-ds-surface');
  });

  it('does not apply sticky classes by default', () => {
    render(<Table columns={columns} data={data} getRowKey={getRowKey} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).not.toHaveClass('sticky');
  });

  it('renders emptyState inside a single full-width row when data is empty', () => {
    render(<Table columns={columns} data={[]} getRowKey={getRowKey} emptyState={<span>No records found</span>} />);
    expect(screen.getByText('No records found')).toBeInTheDocument();
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(1);
    expect(screen.getByRole('cell')).toHaveAttribute('colspan', String(columns.length));
  });

  it('has no accessibility violations for a populated table', async () => {
    const { container } = render(<Table columns={columns} data={data} getRowKey={getRowKey} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
