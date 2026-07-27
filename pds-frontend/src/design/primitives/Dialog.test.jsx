// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Dialog from './Dialog';

afterEach(() => {
  cleanup();
});

function OpenCloseHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Harness dialog">
        <p>Body content</p>
      </Dialog>
    </div>
  );
}

describe('Dialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        <p>Body</p>
      </Dialog>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with role="dialog", aria-modal="true" and an accessible name from the title', () => {
    render(
      <Dialog open onClose={() => {}} title="Settings">
        <p>Body</p>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when the overlay is clicked but not when the content is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Dialog open onClose={onClose} title="Test">
        <p>Body text</p>
      </Dialog>
    );

    await user.click(screen.getByText('Body text'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Test">
        <p>Body</p>
      </Dialog>
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed while open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Test">
        <p>Body</p>
      </Dialog>
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the first focusable element (the close button) on open', () => {
    render(
      <Dialog open onClose={() => {}} title="Test">
        <p>Body</p>
      </Dialog>
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('traps Tab focus within the dialog, wrapping from the last focusable back to the first', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => {}} title="Test" footer={<button>Save</button>}>
        <input placeholder="Name" />
      </Dialog>
    );
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const input = screen.getByPlaceholderText('Name');
    const saveButton = screen.getByRole('button', { name: 'Save' });

    expect(closeButton).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab();
    expect(saveButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable back to the last', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open onClose={() => {}} title="Test" footer={<button>Save</button>}>
        <input placeholder="Name" />
      </Dialog>
    );
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const saveButton = screen.getByRole('button', { name: 'Save' });

    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(saveButton).toHaveFocus();
  });

  it('returns focus to the previously focused element after closing', async () => {
    const user = userEvent.setup();
    render(<OpenCloseHarness />);
    const openButton = screen.getByRole('button', { name: 'Open dialog' });

    await user.click(openButton);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(openButton).toHaveFocus();
  });

  it('only renders the footer region when footer is passed', () => {
    const { rerender } = render(
      <Dialog open onClose={() => {}} title="No footer">
        <p>Body</p>
      </Dialog>
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    rerender(
      <Dialog open onClose={() => {}} title="With footer" footer={<button>Save</button>}>
        <p>Body</p>
      </Dialog>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('has no accessibility violations when open with a title and footer', async () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="Accessible dialog" footer={<button>Confirm</button>}>
        <p>Body content</p>
      </Dialog>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
