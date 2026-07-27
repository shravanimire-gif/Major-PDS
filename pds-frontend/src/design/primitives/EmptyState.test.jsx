// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Search } from 'lucide-react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the required title', () => {
    render(<EmptyState title="No results found" />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('renders the optional description when provided', () => {
    render(<EmptyState title="No results" description="Try a different search." />);
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
  });

  it('omits the description when not provided', () => {
    render(<EmptyState title="No results" />);
    expect(screen.queryByText(/try a different search/i)).not.toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    const { container } = render(
      <EmptyState title="No results" icon={<Search data-testid="empty-icon" />} />
    );
    expect(container.querySelector('[data-testid="empty-icon"]')).toBeInTheDocument();
  });

  it('renders the action and it is interactive', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EmptyState title="No results" action={<button onClick={onClick}>Retry</button>} />);
    const button = screen.getByRole('button', { name: 'Retry' });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the action when not provided', () => {
    render(<EmptyState title="No results" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations when fully labeled', async () => {
    const { container } = render(
      <EmptyState
        title="No devices found"
        description="Try adjusting your filters."
        icon={<Search aria-hidden="true" />}
        action={<button>Clear filters</button>}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
