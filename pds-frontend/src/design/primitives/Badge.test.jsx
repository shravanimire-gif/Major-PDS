// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import Badge from './Badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('defaults to neutral tone and sm size classes', () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText('Default');
    expect(el).toHaveClass('bg-ds-sunken', 'text-ds-text-secondary', 'px-1.5', 'py-0.5');
  });

  it.each([
    ['info', ['bg-ds-info/10', 'text-ds-info']],
    ['success', ['bg-ds-success/10', 'text-ds-success']],
    ['warning', ['bg-ds-warning/10', 'text-ds-warning']],
    ['danger', ['bg-ds-danger/10', 'text-ds-danger']],
  ])('applies %s tone classes', (tone, classes) => {
    render(<Badge tone={tone}>Label</Badge>);
    expect(screen.getByText('Label')).toHaveClass(...classes);
  });

  it('applies md size padding', () => {
    render(<Badge size="md">Big</Badge>);
    expect(screen.getByText('Big')).toHaveClass('px-2', 'py-1');
  });

  it('always uses uppercase tabular-nums text styling', () => {
    render(<Badge>Count</Badge>);
    expect(screen.getByText('Count')).toHaveClass('uppercase', 'tabular-nums', 'text-ds-xs', 'rounded-ds-sm');
  });

  it('merges custom className', () => {
    render(<Badge className="custom-class">Merged</Badge>);
    expect(screen.getByText('Merged')).toHaveClass('custom-class');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Badge tone="success">Healthy</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
