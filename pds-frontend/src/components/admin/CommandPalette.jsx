import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../../api/axios';
import cx from '../ui/cx';
import { ADMIN_NAV_SECTIONS } from '../../config/adminNav';

const DEBOUNCE_MS = 150;

const STATIC_ROUTE_ITEMS = ADMIN_NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ id: item.to, label: item.label, to: item.to, meta: section.title }))
);

function matches(query, ...fields) {
  const q = query.toLowerCase();
  return fields.some((field) => String(field ?? '').toLowerCase().includes(q));
}

/**
 * Global admin search (Ctrl/Cmd+K): searches nav routes plus shops,
 * beneficiaries, and devices by fetching each entity's existing list
 * endpoint once (lazily, on first open) and filtering client-side — the
 * same approach Users.jsx's own search box already uses, since none of
 * these endpoints support a server-side `q=` param. Mount once, near the
 * top of the admin layout, alongside `useGlobalShortcuts`.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [entities, setEntities] = useState(null);
  const [loadingEntities, setLoadingEntities] = useState(true);

  // Reset the whole search session each time the palette opens, and reset
  // selectedIndex whenever the debounced result set changes — both done
  // during rendering rather than in an effect, per React's documented
  // "adjust state when a prop changes" pattern. This avoids a synchronous
  // setState inside a useEffect body entirely (the thing the
  // react-hooks/set-state-in-effect rule flags), rather than working
  // around it.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setEntities(null);
      setLoadingEntities(true);
    }
  }

  const [indexResetKey, setIndexResetKey] = useState(debouncedQuery);
  if (indexResetKey !== debouncedQuery) {
    setIndexResetKey(debouncedQuery);
    setSelectedIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Lazy, re-fetched on every open (the render-time reset above clears
  // `entities` first) rather than cached indefinitely — these lists are
  // small enough that a fresh fetch per open is simpler than invalidation.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    Promise.allSettled([
      api.get('/api/admin/shops'),
      api.get('/api/admin/ration-cards'),
      api.get('/api/admin/iot/fleet'),
    ]).then(([shopsRes, cardsRes, fleetRes]) => {
      if (cancelled) return;
      setEntities({
        shops: shopsRes.status === 'fulfilled' ? shopsRes.value.data?.shops ?? shopsRes.value.data ?? [] : [],
        beneficiaries: cardsRes.status === 'fulfilled' ? cardsRes.value.data?.cards ?? cardsRes.value.data ?? [] : [],
        devices: fleetRes.status === 'fulfilled' ? fleetRes.value.data?.devices ?? fleetRes.value.data ?? [] : [],
      });
      setLoadingEntities(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const groups = useMemo(() => {
    const q = debouncedQuery.trim();
    const result = [];

    const routeMatches = q
      ? STATIC_ROUTE_ITEMS.filter((item) => matches(q, item.label, item.meta))
      : STATIC_ROUTE_ITEMS;
    if (routeMatches.length > 0) {
      result.push({
        group: 'Routes',
        items: routeMatches.map((item) => ({ id: `route:${item.id}`, label: item.label, sublabel: item.meta, to: item.to })),
      });
    }

    if (q && entities) {
      const shopMatches = entities.shops
        .filter((s) => matches(q, s.shop_code, s.shop_name, s.area_name, s.shopkeeper_name))
        .slice(0, 8)
        .map((s) => ({
          id: `shop:${s.id}`,
          label: s.shop_name,
          sublabel: [s.shop_code, s.area_name].filter(Boolean).join(' · '),
          to: '/admin/shops',
        }));
      if (shopMatches.length > 0) result.push({ group: 'Shops', items: shopMatches });

      const beneficiaryMatches = entities.beneficiaries
        .filter((c) => matches(q, c.card_number, c.head_name, c.name, c.shop_name))
        .slice(0, 8)
        .map((c) => ({
          id: `beneficiary:${c.id}`,
          label: c.head_name || c.name || c.card_number,
          sublabel: c.card_number,
          to: '/admin/beneficiaries',
          mono: true,
        }));
      if (beneficiaryMatches.length > 0) result.push({ group: 'Beneficiaries', items: beneficiaryMatches });

      const deviceMatches = entities.devices
        .filter((d) => matches(q, d.device_id, d.shop_name, d.shop_code))
        .slice(0, 8)
        .map((d) => ({
          id: `device:${d.device_id}`,
          label: d.device_id,
          sublabel: d.shop_name,
          to: '/admin/health/iot',
          mono: true,
        }));
      if (deviceMatches.length > 0) result.push({ group: 'Devices', items: deviceMatches });
    }

    return result;
  }, [debouncedQuery, entities]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  if (!open) return null;

  function go(item) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(flatItems[selectedIndex]);
    }
  }

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ds-overlay/40 pt-24"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl rounded-ds-lg bg-ds-surface shadow-ds-md"
      >
        <div className="flex items-center gap-2 border-b border-ds-subtle px-4 py-3">
          <Search size={16} className="text-ds-text-tertiary" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search routes, shops, beneficiaries, devices…"
            className="w-full bg-transparent text-ds-body text-ds-text-primary placeholder:text-ds-text-tertiary focus:outline-none"
          />
        </div>

        <div id="command-palette-results" className="max-h-96 overflow-y-auto py-2">
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-ds-body text-ds-text-secondary">
              {loadingEntities ? 'Loading…' : 'No matches.'}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.group} className="px-2 py-1">
                <div className="px-2 pb-1 text-ds-xs font-medium uppercase tracking-wide text-ds-text-tertiary">
                  {group.group}
                </div>
                <ul>
                  {group.items.map((item) => {
                    runningIndex += 1;
                    const isSelected = runningIndex === selectedIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setSelectedIndex(runningIndex)}
                          onClick={() => go(item)}
                          className={cx(
                            'flex w-full items-center justify-between gap-3 rounded-ds-md px-2 py-2 text-left text-ds-body',
                            isSelected ? 'bg-ds-surface-alt text-ds-text-primary' : 'text-ds-text-primary'
                          )}
                        >
                          <span className={item.mono ? 'font-mono-ds text-ds-mono-sm' : undefined}>{item.label}</span>
                          {item.sublabel ? (
                            <span className="shrink-0 text-ds-small text-ds-text-tertiary">{item.sublabel}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ds-subtle px-4 py-2 text-ds-xs text-ds-text-tertiary">
          <span>
            <kbd className="font-mono-ds">g d</kbd> Dashboard
          </span>
          <span>
            <kbd className="font-mono-ds">g s</kbd> Shops
          </span>
          <span>
            <kbd className="font-mono-ds">g h b</kbd> Blockchain
          </span>
          <span>
            <kbd className="font-mono-ds">g h i</kbd> IoT Fleet
          </span>
          <span>
            <kbd className="font-mono-ds">g a</kbd> Anomalies
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
