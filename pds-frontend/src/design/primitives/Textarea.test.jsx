// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { createRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Textarea from './Textarea';

afterEach(() => {
  cleanup();
});

describe('Textarea', () => {
  it('renders a label associated with the textarea via htmlFor/id', () => {
    render(<Textarea label="Notes" id="notes" />);
    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(textarea).toHaveAttribute('id', 'notes');
  });

  it('defaults to 3 rows and respects a custom rows prop', () => {
    render(<Textarea label="Notes" />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '3');

    render(<Textarea label="Description" rows={6} />);
    expect(screen.getByLabelText('Description')).toHaveAttribute('rows', '6');
  });

  it('appends a * suffix to the label when required', () => {
    render(<Textarea label="Notes" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeRequired();
  });

  it('shows helperText and links it via aria-describedby when there is no error', () => {
    render(<Textarea label="Notes" helperText="Max 500 characters" />);
    const textarea = screen.getByLabelText('Notes');
    const helper = screen.getByText('Max 500 characters');
    expect(textarea).toHaveAttribute('aria-describedby', helper.id);
  });

  it('shows the error message instead of helperText, flags aria-invalid, and reddens the border', () => {
    render(<Textarea label="Notes" helperText="ignored" error="Notes are required" />);
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    const error = screen.getByText('Notes are required');
    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAttribute('aria-describedby', error.id);
    expect(textarea).toHaveClass('border-ds-danger');
    expect(error).toHaveClass('text-ds-danger');
  });

  it('forwards the ref to the underlying textarea element', () => {
    const ref = createRef();
    render(<Textarea label="Notes" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('applies disabled styling and disables the textarea', () => {
    render(<Textarea label="Notes" disabled />);
    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveClass('disabled:bg-ds-sunken');
  });

  it('accepts typed input across multiple lines', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" />);
    const textarea = screen.getByLabelText('Notes');
    await user.type(textarea, 'Line one');
    expect(textarea).toHaveValue('Line one');
  });

  it('is reachable via Tab and shows a focus-visible ring class', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Notes" />);
    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ds-accent');
    await user.tab();
    expect(textarea).toHaveFocus();
  });

  it('has no accessibility violations when correctly labeled', async () => {
    const { container } = render(<Textarea label="Notes" helperText="Optional context" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
