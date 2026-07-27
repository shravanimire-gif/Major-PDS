// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ToastProvider, { useToast } from './Toast';

function TestTrigger() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast({ tone: 'success', message: 'Saved successfully' })}>
        Show success
      </button>
      <button
        onClick={() =>
          showToast({ tone: 'danger', title: 'Error', message: 'Something went wrong' })
        }
      >
        Show danger
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <TestTrigger />
    </ToastProvider>
  );
}

describe('Toast', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows a success toast with role="status" when triggered', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Show success' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved successfully');
  });

  it('shows a danger toast with role="alert" including its title', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Show danger' }));
    const alertToast = screen.getByRole('alert');
    expect(alertToast).toHaveTextContent('Error');
    expect(alertToast).toHaveTextContent('Something went wrong');
  });

  it('auto-dismisses a success toast after 5000ms', () => {
    vi.useFakeTimers();
    renderWithProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Show success' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not auto-dismiss a danger toast even after a long delay', () => {
    vi.useFakeTimers();
    renderWithProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Show danger' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('removes a danger toast when its dismiss button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Show danger' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('throws when useToast is called outside a ToastProvider', () => {
    const Bare = () => {
      useToast();
      return null;
    };
    expect(() => render(<Bare />)).toThrow(/ToastProvider/);
  });

  it('Tab reaches the dismiss button, which shows a focus-visible ring', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Show success' }));
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toHaveClass('focus-visible:ring-2');

    await user.tab(); // Show success -> Show danger
    await user.tab(); // Show danger -> Dismiss
    expect(dismissButton).toHaveFocus();
  });

  it('pressing Enter on the focused dismiss button dismisses the toast', async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Show danger' }));
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    dismissButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no accessibility violations on a rendered toast', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProvider();
    await user.click(screen.getByRole('button', { name: 'Show success' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
