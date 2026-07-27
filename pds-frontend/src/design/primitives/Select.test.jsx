// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { createRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Select from './Select';

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
];

describe('Select', () => {
  it('renders a label associated with the select via htmlFor/id', () => {
    render(<Select label="Country" id="country" options={OPTIONS} />);
    const select = screen.getByLabelText('Country');
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select).toHaveAttribute('id', 'country');
  });

  it('renders options from the options prop', () => {
    render(<Select label="Country" options={OPTIONS} />);
    expect(screen.getByRole('option', { name: 'United States' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Canada' })).toBeInTheDocument();
  });

  it('renders <option> children instead of options when both are passed', () => {
    render(
      <Select label="Country" options={OPTIONS}>
        <option value="fr">France</option>
      </Select>
    );
    expect(screen.getByRole('option', { name: 'France' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'United States' })).not.toBeInTheDocument();
  });

  it('appends a * suffix to the label when required', () => {
    render(<Select label="Country" options={OPTIONS} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByLabelText(/Country/)).toBeRequired();
  });

  it('shows helperText and links it via aria-describedby when there is no error', () => {
    render(<Select label="Country" options={OPTIONS} helperText="Pick one" />);
    const select = screen.getByLabelText('Country');
    const helper = screen.getByText('Pick one');
    expect(select).toHaveAttribute('aria-describedby', helper.id);
  });

  it('shows the error message instead of helperText, flags aria-invalid, and reddens the border', () => {
    render(<Select label="Country" options={OPTIONS} helperText="ignored" error="Required" />);
    expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    const error = screen.getByText('Required');
    const select = screen.getByLabelText('Country');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', error.id);
    expect(select).toHaveClass('border-ds-danger');
    expect(error).toHaveClass('text-ds-danger');
  });

  it('forwards the ref to the underlying select element', () => {
    const ref = createRef();
    render(<Select label="Country" options={OPTIONS} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('applies disabled styling and disables the select', () => {
    render(<Select label="Country" options={OPTIONS} disabled />);
    const select = screen.getByLabelText('Country');
    expect(select).toBeDisabled();
    expect(select).toHaveClass('disabled:bg-ds-sunken');
  });

  it('lets the user choose an option via keyboard selection', async () => {
    const user = userEvent.setup();
    render(<Select label="Country" options={OPTIONS} />);
    const select = screen.getByLabelText('Country');
    await user.selectOptions(select, 'ca');
    expect(select).toHaveValue('ca');
  });

  it('is reachable via Tab and shows a focus-visible ring class', async () => {
    const user = userEvent.setup();
    render(<Select label="Country" options={OPTIONS} />);
    const select = screen.getByLabelText('Country');
    expect(select).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ds-accent');
    await user.tab();
    expect(select).toHaveFocus();
  });

  it('has no accessibility violations when correctly labeled', async () => {
    const { container } = render(
      <Select label="Country" options={OPTIONS} helperText="Pick your country" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
