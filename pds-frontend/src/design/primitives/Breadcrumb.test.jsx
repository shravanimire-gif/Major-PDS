// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Breadcrumb from './Breadcrumb';

// This project's vitest setup does not register RTL's automatic afterEach
// cleanup, so each test file does it explicitly to avoid DOM from previous
// tests leaking into subsequent assertions.
afterEach(() => {
  cleanup();
});

const items = [
  { label: 'Home', href: '/' },
  { label: 'Devices', href: '/devices' },
  { label: 'Device 42', href: '/devices/42' },
];

describe('Breadcrumb', () => {
  it('renders a nav landmark labeled Breadcrumb with an ordered list of items', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders earlier items as links with their href', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Devices' })).toHaveAttribute('href', '/devices');
  });

  it('renders the last item as plain text (current page), not a link, even though it has an href', () => {
    render(<Breadcrumb items={items} />);
    expect(screen.queryByRole('link', { name: 'Device 42' })).not.toBeInTheDocument();
    const current = screen.getByText('Device 42');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('renders a chevron separator between items but not before the first item', () => {
    const { container } = render(<Breadcrumb items={items} />);
    const listItems = container.querySelectorAll('li');
    expect(listItems[0].querySelector('svg')).toBeNull();
    expect(listItems[1].querySelector('svg')).not.toBeNull();
    expect(listItems[2].querySelector('svg')).not.toBeNull();
  });

  it('hides chevrons from assistive tech', () => {
    const { container } = render(<Breadcrumb items={items} />);
    const chevrons = container.querySelectorAll('svg');
    chevrons.forEach((chevron) => {
      expect(chevron).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('uses a custom renderLink for non-current items when provided', () => {
    render(
      <Breadcrumb
        items={items}
        renderLink={(item) => (
          <button type="button" data-key={item.label}>
            {item.label}
          </button>
        )}
      />
    );
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devices' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('is reachable via Tab and shows a focus-visible ring on links', async () => {
    const user = userEvent.setup();
    render(<Breadcrumb items={items} />);
    const homeLink = screen.getByRole('link', { name: 'Home' });
    expect(homeLink).toHaveClass('focus-visible:ring-2');
    expect(homeLink).toHaveClass('focus-visible:ring-ds-accent');
    await user.tab();
    expect(homeLink).toHaveFocus();
  });

  it('has no accessibility violations when used correctly', async () => {
    const { container } = render(<Breadcrumb items={items} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
