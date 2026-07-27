// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Radio from './Radio';

afterEach(() => {
  cleanup();
});

describe('Radio', () => {
  it('renders a label associated with the radio via htmlFor/id', () => {
    render(<Radio label="Option A" id="option-a" name="group" value="a" />);
    const radio = screen.getByLabelText('Option A');
    expect(radio).toBeInstanceOf(HTMLInputElement);
    expect(radio).toHaveAttribute('type', 'radio');
    expect(radio).toHaveAttribute('id', 'option-a');
  });

  it('generates an id via useId when none is passed', () => {
    render(<Radio label="Option B" name="group" value="b" />);
    expect(screen.getByLabelText('Option B').id).toBeTruthy();
  });

  it('shares name/value across a group and only the checked one is selected', () => {
    render(
      <>
        <Radio label="One" name="group" value="one" checked onChange={() => {}} />
        <Radio label="Two" name="group" value="two" checked={false} onChange={() => {}} />
      </>
    );
    expect(screen.getByLabelText('One')).toBeChecked();
    expect(screen.getByLabelText('Two')).not.toBeChecked();
    expect(screen.getByLabelText('One')).toHaveAttribute('name', 'group');
  });

  it('shows a filled dot and accent border when checked', () => {
    const { container } = render(<Radio label="Selected" name="g" value="v" checked onChange={() => {}} />);
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual).toHaveClass('border-ds-accent');
    expect(visual.querySelector('span')).toBeInTheDocument();
  });

  it('shows no filled dot when unchecked', () => {
    const { container } = render(<Radio label="Unselected" name="g" value="v" checked={false} onChange={() => {}} />);
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual).toHaveClass('border-ds-default');
    expect(visual.querySelector('span')).not.toBeInTheDocument();
  });

  it('disables the input and dims the control when disabled', () => {
    render(<Radio label="Locked" name="g" value="v" disabled onChange={() => {}} />);
    const radio = screen.getByLabelText('Locked');
    expect(radio).toBeDisabled();
    expect(radio.closest('label')).toHaveClass('opacity-60', 'cursor-not-allowed');
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Radio label="Click me" name="g" value="v" checked={false} onChange={onChange} />);
    await user.click(screen.getByLabelText('Click me'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is reachable via Tab and shows a focus-visible ring class', async () => {
    const user = userEvent.setup();
    const { container } = render(<Radio label="Keyboard" name="g" value="v" checked={false} onChange={() => {}} />);
    const visual = container.querySelector('[aria-hidden="true"]');
    expect(visual).toHaveClass('peer-focus-visible:ring-2', 'peer-focus-visible:ring-ds-accent');
    await user.tab();
    expect(screen.getByLabelText('Keyboard')).toHaveFocus();
  });

  it('forwards the ref to the underlying input element', () => {
    const ref = createRef();
    render(<Radio label="Ref test" name="g" value="v" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('has no accessibility violations when correctly labeled', async () => {
    const { container } = render(<Radio label="I agree" name="g" value="v" checked onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
