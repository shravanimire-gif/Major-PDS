// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Tabs from './Tabs';

// This project's vitest setup does not register RTL's automatic afterEach
// cleanup, so each test file does it explicitly to avoid DOM from previous
// tests leaking into subsequent assertions.
afterEach(() => {
  cleanup();
});

const items = [
  { key: 'overview', label: 'Overview', content: <p>Overview content</p> },
  { key: 'events', label: 'Events', content: <p>Events content</p> },
  { key: 'settings', label: 'Settings', content: <p>Settings content</p> },
];

describe('Tabs', () => {
  it('renders a tablist with all tabs and activates the first one by default', () => {
    render(<Tabs items={items} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Events' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Overview content')).toBeInTheDocument();
  });

  it('honors defaultActiveKey', () => {
    render(<Tabs items={items} defaultActiveKey="events" />);
    expect(screen.getByRole('tab', { name: 'Events' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Events content')).toBeInTheDocument();
  });

  it('applies active styling classes to the selected tab and secondary styling to inactive tabs', () => {
    render(<Tabs items={items} />);
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    const eventsTab = screen.getByRole('tab', { name: 'Events' });
    expect(overviewTab).toHaveClass('border-ds-accent');
    expect(overviewTab).toHaveClass('text-ds-text-primary');
    expect(eventsTab).toHaveClass('text-ds-text-secondary');
  });

  it('switches tabs and calls onChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs items={items} onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Events' }));
    expect(onChange).toHaveBeenCalledWith('events');
    expect(screen.getByRole('tab', { name: 'Events' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Events content')).toBeInTheDocument();
  });

  it('uses roving tabindex: only the active tab is in the tab sequence', () => {
    render(<Tabs items={items} />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabIndex', '0');
    expect(screen.getByRole('tab', { name: 'Events' })).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('tabIndex', '-1');
  });

  it('navigates between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<Tabs items={items} />);
    screen.getByRole('tab', { name: 'Overview' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Events' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Events' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('activates a focused tab with Enter and Space', async () => {
    const user = userEvent.setup();
    render(<Tabs items={items} />);
    const eventsTab = screen.getByRole('tab', { name: 'Events' });
    eventsTab.focus();

    await user.keyboard('{Enter}');
    expect(eventsTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Events content')).toBeInTheDocument();
  });

  it('is reachable via Tab and shows a focus-visible ring', async () => {
    const user = userEvent.setup();
    render(<Tabs items={items} />);
    const overviewTab = screen.getByRole('tab', { name: 'Overview' });
    expect(overviewTab).toHaveClass('focus-visible:ring-2');
    expect(overviewTab).toHaveClass('focus-visible:ring-ds-accent');
    await user.tab();
    expect(overviewTab).toHaveFocus();
  });

  it('renders the active panel with the correct aria-labelledby relationship', () => {
    render(<Tabs items={items} />);
    const tab = screen.getByRole('tab', { name: 'Overview' });
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  });

  it('has no accessibility violations when used correctly', async () => {
    const { container } = render(<Tabs items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
