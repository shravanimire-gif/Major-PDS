// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Checkbox from './Checkbox';

afterEach(() => {
  cleanup();
});

describe('Checkbox', () => {
  it('renders a label associated with the checkbox via htmlFor/id', () => {
    render(<Checkbox label="Accept terms" id="accept" />);
    const checkbox = screen.getByLabelText('Accept terms');
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect(checkbox).toHaveAttribute('type', 'checkbox');
    expect(checkbox).toHaveAttribute('id', 'accept');
  });

  it('generates an id via useId when none is passed', () => {
    render(<Checkbox label="Subscribe" />);
    expect(screen.getByLabelText('Subscribe').id).toBeTruthy();
  });

  it('shows no check mark when unchecked', () => {
    const { container } = render(<Checkbox label="Opt in" checked={false} onChange={() => {}} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual).toHaveClass('border-ds-default', 'bg-ds-surface');
  });

  it('shows a check mark and accent styling when checked', () => {
    const { container } = render(<Checkbox label="Opt in" checked onChange={() => {}} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual).toHaveClass('border-ds-accent', 'bg-ds-accent');
  });

  it('disables the input and dims the control when disabled', () => {
    render(<Checkbox label="Locked" disabled onChange={() => {}} />);
    const checkbox = screen.getByLabelText('Locked');
    expect(checkbox).toBeDisabled();
    expect(checkbox.closest('label')).toHaveClass('opacity-60', 'cursor-not-allowed');
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Click me" checked={false} onChange={onChange} />);
    await user.click(screen.getByLabelText('Click me'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is reachable via Tab, shows a focus-visible ring class, and toggles with Space', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Checkbox label="Keyboard" checked={false} onChange={onChange} />);
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual).toHaveClass('peer-focus-visible:ring-2', 'peer-focus-visible:ring-ds-accent');
    await user.tab();
    expect(screen.getByLabelText('Keyboard')).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forwards the ref to the underlying input element', () => {
    const ref = createRef();
    render(<Checkbox label="Ref test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('has no accessibility violations when correctly labeled', async () => {
    const { container } = render(<Checkbox label="I agree" checked onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
