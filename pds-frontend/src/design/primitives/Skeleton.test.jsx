// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing before the delay elapses', () => {
    const { container } = render(<Skeleton delay={300} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the placeholder after the default 300ms delay', () => {
    const { container } = render(<Skeleton />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('respects a custom delay', () => {
    render(<Skeleton delay={1000} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders `count` repeated lines for the text shape', () => {
    const { container } = render(<Skeleton shape="text" count={3} delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3);
  });

  it('renders a block shape with block-appropriate rounding', () => {
    const { container } = render(<Skeleton shape="block" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(container.querySelector('.animate-pulse')).toHaveClass('rounded-ds-md');
  });

  it('renders a row shape as multiple column segments', () => {
    const { container } = render(<Skeleton shape="row" delay={0} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(1);
  });

  it('applies custom width and height to a block placeholder', () => {
    const { container } = render(
      <Skeleton shape="block" width="10rem" height="2rem" delay={0} />
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(container.querySelector('.animate-pulse')).toHaveStyle({
      width: '10rem',
      height: '2rem',
    });
  });

  it('clears its timer on unmount without throwing', () => {
    const { unmount } = render(<Skeleton delay={300} />);
    unmount();
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }).not.toThrow();
  });
});
