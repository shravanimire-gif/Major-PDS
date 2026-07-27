// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Switch from './Switch';

afterEach(() => {
  cleanup();
});

describe('Switch', () => {
  it('renders with role="switch" and aria-checked reflecting the checked prop', () => {
    render(<Switch label="Notifications" checked={false} onChange={() => {}} />);
    const switchEl = screen.getByRole('switch', { name: 'Notifications' });
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
  });

  it('shows the accent track and translated thumb when checked', () => {
    render(<Switch label="Notifications" checked onChange={() => {}} />);
    const switchEl = screen.getByRole('switch', { name: 'Notifications' });
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
    expect(switchEl).toHaveClass('bg-ds-accent');
    expect(switchEl.querySelector('[aria-hidden="true"]')).toHaveClass('translate-x-4');
  });

  it('shows the neutral track and resting thumb when off', () => {
    render(<Switch label="Notifications" checked={false} onChange={() => {}} />);
    const switchEl = screen.getByRole('switch', { name: 'Notifications' });
    expect(switchEl).toHaveClass('bg-ds-border-default');
    expect(switchEl.querySelector('[aria-hidden="true"]')).toHaveClass('translate-x-0.5');
  });

  it('renders without a label when none is provided', () => {
    render(<Switch checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('disables the control and dims the wrapper when disabled', () => {
    render(<Switch label="Locked" disabled onChange={() => {}} />);
    const switchEl = screen.getByRole('switch', { name: 'Locked' });
    expect(switchEl).toBeDisabled();
    expect(switchEl.closest('span')).toHaveClass('opacity-60', 'cursor-not-allowed');
  });

  it('calls onChange with the next boolean value when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Notifications" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Notifications' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is reachable via Tab, shows a focus-visible ring class, and toggles with Space and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Notifications" checked={false} onChange={onChange} />);
    const switchEl = screen.getByRole('switch', { name: 'Notifications' });
    expect(switchEl).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ds-accent');
    await user.tab();
    expect(switchEl).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(true);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('forwards the ref to the underlying button element', () => {
    const ref = createRef();
    render(<Switch label="Ref test" onChange={() => {}} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has no accessibility violations when correctly labeled', async () => {
    const { container } = render(<Switch label="Enable feature" checked onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
