// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'jest-axe';
import AppShell from './AppShell';

afterEach(() => {
  cleanup();
});

function renderShell(props) {
  return render(
    <MemoryRouter>
      <AppShell {...props}>
        <p>Page content</p>
      </AppShell>
    </MemoryRouter>
  );
}

describe('AppShell', () => {
  it('renders the children passed to it', () => {
    renderShell();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('renders the "PDS Supervision" wordmark', () => {
    renderShell();
    expect(screen.getByText('PDS Supervision')).toBeInTheDocument();
  });

  it('renders the default nav section headers', () => {
    renderShell();
    expect(screen.getByText('OVERVIEW')).toBeInTheDocument();
    expect(screen.getByText('OPERATIONS')).toBeInTheDocument();
    expect(screen.getByText('HEALTH')).toBeInTheDocument();
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
  });

  it('renders the default nav items as links inside a nav labeled Main', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
  });

  it('does not render the environment pill for the default (production) environment', () => {
    renderShell();
    expect(screen.queryByText('production', { exact: false })).not.toBeInTheDocument();
  });

  it('renders the environment pill with the correct text for staging', () => {
    renderShell({ environment: 'staging' });
    expect(screen.getByText('staging')).toBeInTheDocument();
  });

  it('renders the environment pill for development', () => {
    renderShell({ environment: 'development' });
    expect(screen.getByText('development')).toBeInTheDocument();
  });

  it('renders a logout trigger with the name and initials when a user is provided, and calls onLogout when clicked', () => {
    const onLogout = vi.fn();
    renderShell({ user: { name: 'Jane Doe', email: 'jane@example.com' }, onLogout });
    const trigger = screen.getByRole('button', { name: 'Log out Jane Doe' });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('does not render a logout trigger when no user is provided', () => {
    renderShell();
    expect(screen.queryByRole('button', { name: /Log out/ })).not.toBeInTheDocument();
  });

  it('renders the breadcrumb prop as-is in the top bar', () => {
    renderShell({ breadcrumb: <span>Devices / Detail</span> });
    expect(screen.getByText('Devices / Detail')).toBeInTheDocument();
  });

  it('renders topBarActions as-is in the top bar', () => {
    renderShell({ topBarActions: <button type="button">Extra action</button> });
    expect(screen.getByRole('button', { name: 'Extra action' })).toBeInTheDocument();
  });

  // The drawer's <aside> content (including its X button) stays mounted at
  // all times so the CSS transform transition can animate it in/out — only
  // the mobile overlay is conditionally rendered, so that's what these tests
  // assert on as the "is the drawer open" signal.
  it('opens the drawer via the hamburger button and closes it via the X button', () => {
    renderShell();
    expect(screen.queryByTestId('drawer-overlay')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByTestId('drawer-overlay')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(screen.queryByTestId('drawer-overlay')).not.toBeInTheDocument();
  });

  it('closes the drawer when clicking the overlay', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByTestId('drawer-overlay')).not.toBeInTheDocument();
  });

  it('closes the drawer when a nav link is clicked', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.queryByTestId('drawer-overlay')).not.toBeInTheDocument();
  });

  it('has no accessibility violations when used correctly', async () => {
    const { container } = renderShell({
      environment: 'staging',
      user: { name: 'Jane Doe' },
      breadcrumb: <span>Overview</span>,
      onLogout: () => {},
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
