// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import StatusPill from './StatusPill';

afterEach(() => {
  cleanup();
});

describe('StatusPill', () => {
  it('renders a text label alongside the dot', () => {
    render(<StatusPill status="online" label="Online" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('applies success color for online status', () => {
    const { container } = render(<StatusPill status="online" label="Online" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-ds-success', 'rounded-full');
  });

  it('applies warning color for degraded status', () => {
    const { container } = render(<StatusPill status="degraded" label="Degraded" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-ds-warning');
  });

  it('applies danger color for offline status', () => {
    const { container } = render(<StatusPill status="offline" label="Offline" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-ds-danger');
  });

  it('applies disabled color for unknown status', () => {
    const { container } = render(<StatusPill status="unknown" label="Unknown" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-ds-text-disabled');
  });

  it('renders larger dot and text at md size', () => {
    const { container } = render(<StatusPill status="online" label="Online" size="md" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('h-2', 'w-2');
    expect(screen.getByText('Online')).toHaveClass('text-ds-small');
  });

  it('renders smaller dot and text at sm size by default', () => {
    const { container } = render(<StatusPill status="online" label="Online" />);
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('h-1.5', 'w-1.5');
    expect(screen.getByText('Online')).toHaveClass('text-ds-xs');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<StatusPill status="online" label="Online" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
