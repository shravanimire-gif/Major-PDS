// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import SeverityMultiSelect from './SeverityMultiSelect';

afterEach(() => {
  cleanup();
});

const OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

describe('SeverityMultiSelect', () => {
  it('renders the trigger with just the label when nothing is selected', () => {
    render(<SeverityMultiSelect options={OPTIONS} selected={[]} onChange={() => {}} label="Severity" />);
    expect(screen.getByRole('button', { name: 'Severity' })).toBeInTheDocument();
  });

  it('renders the trigger with the selected count appended', () => {
    render(
      <SeverityMultiSelect options={OPTIONS} selected={['critical', 'warn']} onChange={() => {}} label="Severity" />
    );
    expect(screen.getByRole('button', { name: 'Severity (2)' })).toBeInTheDocument();
  });

  it('does not show the panel by default', () => {
    render(<SeverityMultiSelect options={OPTIONS} selected={[]} onChange={() => {}} label="Severity" />);
    expect(screen.queryByLabelText('Critical')).not.toBeInTheDocument();
  });

  it('opens the panel on click, showing one checkbox per option', async () => {
    const user = userEvent.setup();
    render(<SeverityMultiSelect options={OPTIONS} selected={[]} onChange={() => {}} label="Severity" />);
    await user.click(screen.getByRole('button', { name: 'Severity' }));
    expect(screen.getByLabelText('Critical')).toBeInTheDocument();
    expect(screen.getByLabelText('Warning')).toBeInTheDocument();
    expect(screen.getByLabelText('Info')).toBeInTheDocument();
  });

  it('reflects which options are currently selected via checked state', async () => {
    const user = userEvent.setup();
    render(
      <SeverityMultiSelect options={OPTIONS} selected={['warn']} onChange={() => {}} label="Severity" />
    );
    await user.click(screen.getByRole('button', { name: 'Severity (1)' }));
    expect(screen.getByLabelText('Critical')).not.toBeChecked();
    expect(screen.getByLabelText('Warning')).toBeChecked();
    expect(screen.getByLabelText('Info')).not.toBeChecked();
  });

  it('calls onChange with the value added when checking an unselected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SeverityMultiSelect options={OPTIONS} selected={['critical']} onChange={onChange} label="Severity" />
    );
    await user.click(screen.getByRole('button', { name: 'Severity (1)' }));
    await user.click(screen.getByLabelText('Warning'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['critical', 'warn']);
  });

  it('calls onChange with the value removed when unchecking a selected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SeverityMultiSelect
        options={OPTIONS}
        selected={['critical', 'warn']}
        onChange={onChange}
        label="Severity"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Severity (2)' }));
    await user.click(screen.getByLabelText('Critical'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['warn']);
  });

  it('does not close the panel when an option is selected', async () => {
    const user = userEvent.setup();
    render(
      <SeverityMultiSelect options={OPTIONS} selected={[]} onChange={() => {}} label="Severity" />
    );
    await user.click(screen.getByRole('button', { name: 'Severity' }));
    await user.click(screen.getByLabelText('Critical'));
    expect(screen.getByLabelText('Critical')).toBeInTheDocument();
  });

  it('closes the panel when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <SeverityMultiSelect options={OPTIONS} selected={[]} onChange={() => {}} label="Severity" />
        <button type="button">Outside</button>
      </div>
    );
    await user.click(screen.getByRole('button', { name: 'Severity' }));
    expect(screen.getByLabelText('Critical')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByLabelText('Critical')).not.toBeInTheDocument();
  });

  it('closes the panel on Escape', async () => {
    const user = userEvent.setup();
    render(<SeverityMultiSelect options={OPTIONS} selected={[]} onChange={() => {}} label="Severity" />);
    await user.click(screen.getByRole('button', { name: 'Severity' }));
    expect(screen.getByLabelText('Critical')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('Critical')).not.toBeInTheDocument();
  });

  it('has no accessibility violations with the panel open', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SeverityMultiSelect options={OPTIONS} selected={['critical']} onChange={() => {}} label="Severity" />
    );
    await user.click(screen.getByRole('button', { name: 'Severity (1)' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
