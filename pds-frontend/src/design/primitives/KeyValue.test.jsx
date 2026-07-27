// eslint-disable-next-line no-unused-vars -- required in scope: this project's JSX transform is classic (React.createElement), not automatic
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import KeyValue from './KeyValue';

// This project's vitest setup does not register RTL's automatic afterEach
// cleanup, so each test file does it explicitly to avoid DOM from previous
// tests leaking into later queries.
afterEach(() => {
  cleanup();
});

const items = [
  { label: 'Status', value: 'Active' },
  { label: 'Device ID', value: '0xABCD1234', mono: true },
];

describe('KeyValue', () => {
  it('renders as a definition list with a term and description per item', () => {
    const { container } = render(<KeyValue items={items} />);
    expect(container.querySelector('dl')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
  });

  it('renders label in dt and value in dd for each pair', () => {
    render(<KeyValue items={items} />);
    expect(screen.getByText('Status').tagName).toBe('DT');
    expect(screen.getByText('Active').tagName).toBe('DD');
  });

  it('applies the monospace style to values flagged mono', () => {
    render(<KeyValue items={items} />);
    expect(screen.getByText('0xABCD1234')).toHaveClass('font-mono-ds', 'text-ds-mono-sm');
    expect(screen.getByText('Active')).not.toHaveClass('font-mono-ds');
  });

  it('defaults to a 2-column grid at the sm breakpoint', () => {
    const { container } = render(<KeyValue items={items} />);
    expect(container.querySelector('dl')).toHaveClass('sm:grid-cols-2');
  });

  it('applies a custom column count', () => {
    const { container } = render(<KeyValue items={items} columns={3} />);
    expect(container.querySelector('dl')).toHaveClass('sm:grid-cols-3');
  });

  it('renders every item passed in, in order', () => {
    const threeItems = [...items, { label: 'Region', value: 'us-east-1' }];
    const { container } = render(<KeyValue items={threeItems} />);
    const labels = Array.from(container.querySelectorAll('dt')).map((el) => el.textContent);
    expect(labels).toEqual(['Status', 'Device ID', 'Region']);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<KeyValue items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
