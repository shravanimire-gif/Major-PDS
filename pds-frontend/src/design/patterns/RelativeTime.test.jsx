// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import RelativeTime from './RelativeTime';
import { formatAbsoluteTime } from '../../lib/relativeTime';

afterEach(() => {
  cleanup();
});

const NOW = new Date('2026-07-23T12:00:00.000');

describe('RelativeTime', () => {
  it('renders the relative-time text', () => {
    const value = new Date(NOW.getTime() - 45 * 1000);
    render(<RelativeTime value={value} now={NOW} />);
    expect(screen.getByText('45s ago')).toBeInTheDocument();
  });

  it('renders minute-scale relative text', () => {
    const value = new Date(NOW.getTime() - 5 * 60 * 1000);
    render(<RelativeTime value={value} now={NOW} />);
    expect(screen.getByText('5 min ago')).toBeInTheDocument();
  });

  it('applies the ds-small secondary text styling', () => {
    const value = new Date(NOW.getTime() - 5 * 1000);
    render(<RelativeTime value={value} now={NOW} />);
    expect(screen.getByText('5s ago')).toHaveClass('text-ds-small', 'text-ds-text-secondary');
  });

  it('shows the absolute timestamp in a tooltip on hover', async () => {
    const value = new Date(NOW.getTime() - 5 * 1000);
    render(<RelativeTime value={value} now={NOW} />);

    fireEvent.mouseEnter(screen.getByText('5s ago'));
    // Tooltip opens after a delay; wait for it to appear.
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(formatAbsoluteTime(value));
  });

  it('has no accessibility violations', async () => {
    const value = new Date(NOW.getTime() - 5 * 1000);
    const { container } = render(<RelativeTime value={value} now={NOW} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
