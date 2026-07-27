// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { createRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Input from './Input';

afterEach(() => {
  cleanup();
});

describe('Input', () => {
  it('renders a label associated with the input via htmlFor/id', () => {
    render(<Input label="Email" id="email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toHaveAttribute('id', 'email');
  });

  it('generates an id via useId when none is passed', () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input.id).toBeTruthy();
  });

  it('appends a * suffix to the label when required', () => {
    render(<Input label="Name" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeRequired();
  });

  it('shows helperText and links it via aria-describedby when there is no error', () => {
    render(<Input label="Name" helperText="As it appears on your ID" />);
    const input = screen.getByLabelText('Name');
    const helper = screen.getByText('As it appears on your ID');
    expect(input).toHaveAttribute('aria-describedby', helper.id);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the error message instead of helperText, flags aria-invalid, and reddens the border', () => {
    render(<Input label="Name" helperText="ignored" error="Name is required" />);
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    const error = screen.getByText('Name is required');
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(input).toHaveClass('border-ds-danger');
    expect(error).toHaveClass('text-ds-danger');
  });

  it('forwards the ref to the underlying input element', () => {
    const ref = createRef();
    render(<Input label="Name" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('applies disabled styling and disables the input', () => {
    render(<Input label="Name" disabled />);
    const input = screen.getByLabelText('Name');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:bg-ds-sunken');
  });

  it('accepts a value and onChange, and reflects typed input', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    await user.type(input, 'Ada');
    expect(input).toHaveValue('Ada');
  });

  it('is reachable via Tab and shows a focus-visible ring class', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ds-accent');
    await user.tab();
    expect(input).toHaveFocus();
  });

  it('has no accessibility violations when correctly labeled', async () => {
    const { container } = render(<Input label="Email" helperText="We will not share this" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
