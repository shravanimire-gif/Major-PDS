// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Drawer from './Drawer';

afterEach(() => {
  cleanup();
});

function OpenCloseHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open drawer</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Harness drawer">
        <p>Body content</p>
      </Drawer>
    </div>
  );
}

describe('Drawer', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <Drawer open={false} onClose={() => {}} title="Hidden">
        <p>Body</p>
      </Drawer>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with role="dialog", aria-modal="true" and an accessible name from the title when open', () => {
    render(
      <Drawer open onClose={() => {}} title="Raw JSON">
        <p>Body</p>
      </Drawer>
    );
    const drawer = screen.getByRole('dialog', { name: 'Raw JSON' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when the overlay is clicked but not when the panel content is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open onClose={onClose} title="Test">
        <p>Body text</p>
      </Drawer>
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
      <Drawer open onClose={onClose} title="Test">
        <p>Body</p>
      </Drawer>
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed while open', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Test">
        <p>Body</p>
      </Drawer>
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the first focusable element (the close button) on open', () => {
    render(
      <Drawer open onClose={() => {}} title="Test">
        <p>Body</p>
      </Drawer>
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('traps Tab focus within the drawer, wrapping from the last focusable back to the first', async () => {
    const user = userEvent.setup();
    render(
      <Drawer open onClose={() => {}} title="Test" footer={<button>Save</button>}>
        <input placeholder="Name" />
      </Drawer>
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
      <Drawer open onClose={() => {}} title="Test" footer={<button>Save</button>}>
        <input placeholder="Name" />
      </Drawer>
    );
    const closeButton = screen.getByRole('button', { name: 'Close' });
    const saveButton = screen.getByRole('button', { name: 'Save' });

    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(saveButton).toHaveFocus();
  });

  it('returns focus to the trigger that opened it, once closed', async () => {
    const user = userEvent.setup();
    render(<OpenCloseHarness />);
    const openButton = screen.getByRole('button', { name: 'Open drawer' });

    await user.click(openButton);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(openButton).toHaveFocus();
  });

  it('only renders the footer region when footer is passed', () => {
    const { rerender } = render(
      <Drawer open onClose={() => {}} title="No footer">
        <p>Body</p>
      </Drawer>
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    rerender(
      <Drawer open onClose={() => {}} title="With footer" footer={<button>Save</button>}>
        <p>Body</p>
      </Drawer>
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('has no accessibility violations when open with a title and footer', async () => {
    const { container } = render(
      <Drawer open onClose={() => {}} title="Accessible drawer" footer={<button>Confirm</button>}>
        <p>Body content</p>
      </Drawer>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
