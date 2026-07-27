// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import PanelHeader from './PanelHeader';

afterEach(() => {
  cleanup();
});

describe('PanelHeader', () => {
  it('renders the title', () => {
    render(<PanelHeader title="Device Health" />);
    expect(screen.getByText('Device Health')).toBeInTheDocument();
  });

  it('applies title typography classes', () => {
    render(<PanelHeader title="Device Health" />);
    expect(screen.getByText('Device Health')).toHaveClass(
      'text-ds-title',
      'font-semibold',
      'text-ds-text-primary'
    );
  });

  it('renders subtitle when provided', () => {
    render(<PanelHeader title="Device Health" subtitle="Live status across all sites" />);
    const subtitle = screen.getByText('Live status across all sites');
    expect(subtitle).toBeInTheDocument();
    expect(subtitle).toHaveClass('text-ds-body', 'text-ds-text-secondary');
  });

  it('does not render a subtitle element when not provided', () => {
    render(<PanelHeader title="Device Health" />);
    expect(screen.queryByText('Live status across all sites')).not.toBeInTheDocument();
  });

  it('renders actions in the right-side slot', () => {
    render(
      <PanelHeader
        title="Device Health"
        actions={<button type="button">Refresh</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('applies bottom border and spacing classes to the header block', () => {
    render(<PanelHeader title="Device Health" data-testid="panel-header" />);
    const header = screen.getByTestId('panel-header');
    expect(header).toHaveClass('border-b', 'border-ds-subtle', 'pb-4', 'mb-4', 'justify-between');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PanelHeader
        title="Device Health"
        subtitle="Live status across all sites"
        actions={<button type="button">Refresh</button>}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
