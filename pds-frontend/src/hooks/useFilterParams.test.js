import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, act, cleanup, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { useFilterParams } from './useFilterParams';

afterEach(() => {
  cleanup();
});

const DEFAULTS = { severity: 'all', resolved: 'unresolved' };

// renderHook-style harness: renders the hook's current return value as plain
// DOM text (never writes to a ref during render — that trips
// eslint-plugin-react-hooks v7's react-hooks/refs rule) so the test can read
// it back via ordinary RTL queries, and exposes each requested `setFilters`
// call as its own clickable button (`actions` is a list of partial-filter
// objects to wire up, one button per entry, in order).
function Harness({ defaults, actions }) {
  const [filters, setFilters] = useFilterParams(defaults);
  const [searchParams] = useSearchParams();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'filters' }, JSON.stringify(filters)),
    React.createElement('span', { 'data-testid': 'search' }, searchParams.toString()),
    ...actions.map((partial, index) =>
      React.createElement(
        'button',
        {
          key: index,
          type: 'button',
          'data-testid': `action-${index}`,
          onClick: () => setFilters(partial),
        },
        `action-${index}`
      )
    )
  );
}

function renderHarness({ defaults = DEFAULTS, initialEntries = ['/'], actions = [] } = {}) {
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries },
      React.createElement(Harness, { defaults, actions })
    )
  );
}

const filtersValue = () => JSON.parse(screen.getByTestId('filters').textContent);
const searchValue = () => screen.getByTestId('search').textContent;
const clickAction = (index) => act(() => fireEvent.click(screen.getByTestId(`action-${index}`)));

describe('useFilterParams', () => {
  it('applies defaults when the URL has no filter params', () => {
    renderHarness();

    expect(filtersValue()).toEqual(DEFAULTS);
    expect(searchValue()).toBe('');
  });

  it('lets a URL param override its default', () => {
    renderHarness({ initialEntries: ['/?severity=high'] });

    expect(filtersValue()).toEqual({ severity: 'high', resolved: 'unresolved' });
  });

  it('setFilters writes a non-default value into the URL', () => {
    renderHarness({ actions: [{ severity: 'high' }] });

    clickAction(0);

    expect(filtersValue()).toEqual({ severity: 'high', resolved: 'unresolved' });
    expect(searchValue()).toBe('severity=high');
  });

  it('omits a filter from the URL once it is set back to its default', () => {
    renderHarness({ initialEntries: ['/?severity=high'], actions: [{ severity: 'all' }] });
    expect(searchValue()).toBe('severity=high');

    clickAction(0);

    expect(filtersValue()).toEqual(DEFAULTS);
    expect(searchValue()).toBe('');
  });

  it('writes non-default values while omitting default ones side by side', () => {
    renderHarness({ actions: [{ severity: 'all', resolved: 'resolved' }] });

    clickAction(0);

    expect(filtersValue()).toEqual({ severity: 'all', resolved: 'resolved' });
    expect(searchValue()).toBe('resolved=resolved');
  });

  it('replaces the URL rather than pushing a new history entry', () => {
    renderHarness({ actions: [{ severity: 'high' }, { severity: 'medium' }] });

    clickAction(0);
    clickAction(1);

    expect(searchValue()).toBe('severity=medium');
  });

  it('merges a partial update without clobbering other current filters', () => {
    renderHarness({ initialEntries: ['/?severity=high'], actions: [{ resolved: 'resolved' }] });

    clickAction(0);

    expect(filtersValue()).toEqual({ severity: 'high', resolved: 'resolved' });
  });
});
