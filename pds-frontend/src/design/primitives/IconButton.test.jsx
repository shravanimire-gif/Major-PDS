// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import IconButton from './IconButton';

afterEach(() => {
  cleanup();
});

describe('IconButton', () => {
  it('renders with the required ariaLabel as its accessible name and no visible text', () => {
    render(<IconButton icon={<span data-testid="icon" />} ariaLabel="Close" />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveAttribute('aria-label', 'Close');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('defaults to the primary variant and md size', () => {
    render(<IconButton icon={<span />} ariaLabel="Add" />);
    const button = screen.getByRole('button', { name: 'Add' });
    expect(button).toHaveClass('bg-ds-accent');
    expect(button).toHaveClass('p-2');
  });

  it('applies secondary, ghost, and danger variant classes', () => {
    render(<IconButton icon={<span />} ariaLabel="Secondary" variant="secondary" />);
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border-ds-default');

    render(<IconButton icon={<span />} ariaLabel="Ghost" variant="ghost" />);
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass('bg-transparent');

    render(<IconButton icon={<span />} ariaLabel="Danger" variant="danger" />);
    expect(screen.getByRole('button', { name: 'Danger' })).toHaveClass('bg-ds-danger');
  });

  it('applies the sm size classes', () => {
    render(<IconButton icon={<span />} ariaLabel="Small" size="sm" />);
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('p-1.5');
  });

  it('shows a spinner in place of the icon and disables the button while loading', () => {
    render(<IconButton icon={<span data-testid="icon" />} ariaLabel="Refresh" loading />);
    const button = screen.getByRole('button', { name: 'Refresh' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });

  it('disables the button via the disabled prop', () => {
    render(<IconButton icon={<span />} ariaLabel="Disabled action" disabled />);
    expect(screen.getByRole('button', { name: 'Disabled action' })).toBeDisabled();
  });

  it('is reachable via Tab and shows a focus-visible ring', async () => {
    const user = userEvent.setup();
    render(<IconButton icon={<span />} ariaLabel="Focus me" />);
    const button = screen.getByRole('button', { name: 'Focus me' });
    expect(button).toHaveClass('focus-visible:ring-2');
    expect(button).toHaveClass('focus-visible:ring-ds-accent');
    await user.tab();
    expect(button).toHaveFocus();
  });

  it('triggers onClick via Enter and Space when focused', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<IconButton icon={<span />} ariaLabel="Delete" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Delete' });
    button.focus();

    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('has no accessibility violations when used correctly with an aria-label', async () => {
    const { container } = render(<IconButton icon={<span />} ariaLabel="Accessible action" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
