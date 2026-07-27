// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Button from './Button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('renders its label and defaults to the primary variant/md size', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('bg-ds-accent');
    expect(button).toHaveClass('text-ds-body');
  });

  it('applies secondary, ghost, and danger variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass('border-ds-default');

    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass('bg-transparent');

    render(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button', { name: 'Danger' })).toHaveClass('bg-ds-danger');
  });

  it('applies the sm size classes', () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('text-ds-small');
  });

  it('renders iconLeft before and iconRight after the label', () => {
    render(
      <Button iconLeft={<span data-testid="left" />} iconRight={<span data-testid="right" />}>
        Continue
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Continue' });
    const left = screen.getByTestId('left');
    const right = screen.getByTestId('right');
    expect(button).toContainElement(left);
    expect(button).toContainElement(right);
    expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a spinner, keeps the label visible, and disables the button while loading', () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('disables the button via the disabled prop', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  it('is reachable via Tab and shows a focus-visible ring', async () => {
    const user = userEvent.setup();
    render(<Button>Focus me</Button>);
    const button = screen.getByRole('button', { name: 'Focus me' });
    expect(button).toHaveClass('focus-visible:ring-2');
    expect(button).toHaveClass('focus-visible:ring-ds-accent');
    await user.tab();
    expect(button).toHaveFocus();
  });

  it('triggers onClick via Enter and Space when focused', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    button.focus();

    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('has no accessibility violations when used correctly', async () => {
    const { container } = render(<Button>Accessible label</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
