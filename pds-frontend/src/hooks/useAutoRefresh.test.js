import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, screen, fireEvent } from '@testing-library/react';
import { useAutoRefresh } from './useAutoRefresh';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// @testing-library/react-hooks isn't a dependency here, so this stands in
// for renderHook: it renders the hook's current return value as plain DOM
// text/attributes (never writes to a ref during render — that trips
// eslint-plugin-react-hooks v7's react-hooks/refs rule) so the test can read
// it back via ordinary RTL queries, and exposes refetch as a clickable button.
function HookHarness({ fetchFn, options }) {
  const { data, loading, error, lastUpdatedAt, refetch } = useAutoRefresh(fetchFn, options);
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'loading' }, String(loading)),
    React.createElement('span', { 'data-testid': 'data' }, data == null ? '' : String(data)),
    React.createElement('span', { 'data-testid': 'error' }, error ? error.message : ''),
    React.createElement(
      'span',
      { 'data-testid': 'last-updated-at' },
      lastUpdatedAt == null ? '' : String(lastUpdatedAt)
    ),
    React.createElement('button', { type: 'button', 'data-testid': 'refetch', onClick: refetch }, 'refetch')
  );
}

function renderHarness(fetchFn, options) {
  render(React.createElement(HookHarness, { fetchFn, options }));
}

const loadingText = () => screen.getByTestId('loading').textContent;
const dataText = () => screen.getByTestId('data').textContent;
const errorText = () => screen.getByTestId('error').textContent;
const lastUpdatedAtText = () => screen.getByTestId('last-updated-at').textContent;

// Fake timers don't fake the microtask queue, so a resolved/rejected promise
// still needs real ticks to run its .then/.catch/.finally chain. A handful
// of awaited Promise.resolve() calls is enough to drain that chain.
async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

function setDocumentHidden(hidden) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
}

describe('useAutoRefresh', () => {
  it('starts loading and becomes false only after the first fetch settles', async () => {
    const fetchFn = vi.fn().mockResolvedValue('first');
    renderHarness(fetchFn, { intervalMs: 1000 });

    expect(loadingText()).toBe('true');

    await act(async () => {
      await flushMicrotasks();
    });

    expect(loadingText()).toBe('false');
    expect(dataText()).toBe('first');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('never goes back to loading=true on later polls', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue('ok');
    renderHarness(fetchFn, { intervalMs: 1000 });

    await act(async () => {
      await flushMicrotasks();
    });
    expect(loadingText()).toBe('false');

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(loadingText()).toBe('false');
  });

  it('fetches again after intervalMs elapses', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue('ok');
    renderHarness(fetchFn, { intervalMs: 5000 });

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('skips a scheduled poll while document.hidden is true', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue('ok');
    renderHarness(fetchFn, { intervalMs: 5000 });

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    setDocumentHidden(true);
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    setDocumentHidden(false);
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('refetch() fetches immediately without waiting for the interval', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockResolvedValue('ok');
    renderHarness(fetchFn, { intervalMs: 60000 });

    await act(async () => {
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId('refetch'));
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // refetch() must not reset/restart the interval timer.
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await flushMicrotasks();
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('updates lastUpdatedAt after a successful fetch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(12345);
    const fetchFn = vi.fn().mockResolvedValue('ok');
    renderHarness(fetchFn, { intervalMs: 5000 });

    expect(lastUpdatedAtText()).toBe('');

    await act(async () => {
      await flushMicrotasks();
    });

    expect(lastUpdatedAtText()).toBe('12345');

    vi.setSystemTime(99999);
    await act(async () => {
      // Fake-timer time advances the mocked Date along with it, so the poll
      // fires (and calls Date.now()) at 99999 + 5000.
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });

    expect(lastUpdatedAtText()).toBe('104999');
  });

  it('sets error on a failed fetch and clears it on the next success', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('recovered');
    renderHarness(fetchFn, { intervalMs: 5000 });

    await act(async () => {
      await flushMicrotasks();
    });
    expect(errorText()).toBe('boom');
    expect(loadingText()).toBe('false');

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flushMicrotasks();
    });
    expect(errorText()).toBe('');
    expect(dataText()).toBe('recovered');
  });
});
