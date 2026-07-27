// eslint-disable-next-line no-unused-vars -- React must be in scope for the classic JSX transform this project's Vitest/esbuild pipeline uses.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { axe } from 'jest-axe';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('does not render tooltip content by default', () => {
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trigger' })).not.toHaveAttribute(
      'aria-describedby'
    );
  });

  it('shows the tooltip content 200ms after mouseenter', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful hint');
  });

  it('does not show the tooltip before the 200ms delay elapses', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }));
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('hides instantly on mouseleave and cancels a pending open timer', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on focus after the delay and hides instantly on blur', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('sets aria-describedby on the trigger pointing at the visible tooltip id', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('applies the bottom placement classes when placement="bottom"', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint" placement="bottom">
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toHaveClass('top-full');
  });

  it('defaults to top placement classes', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole('tooltip')).toHaveClass('bottom-full');
  });

  it('has no accessibility violations while the tooltip is visible', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <Tooltip content="Helpful hint">
        <button>Trigger</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Trigger' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    vi.useRealTimers();
    expect(await axe(container)).toHaveNoViolations();
  });
});
