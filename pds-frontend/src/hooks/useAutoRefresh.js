import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAutoRefresh — fetch-on-mount plus silent background polling, for any
 * page/panel that wants a live-ish view (fleet status, anomaly counts, a
 * dashboard tile) without flashing a loading state on every poll tick. Use
 * it instead of a bespoke useEffect+setInterval: the very first fetch drives
 * `loading` (so callers can show a Skeleton), but every fetch after that —
 * whether from the interval or from `refetch()` — only ever updates `data`/
 * `error`/`lastUpdatedAt`, so the UI just quietly re-renders with fresh
 * values. Polling automatically pauses while the tab is hidden (unless
 * `pauseWhenHidden` is turned off) so backgrounded tabs don't hammer the API.
 *
 * @param {() => Promise<any>} fetchFn - Async function returning the value to store, e.g. `() => api.get(url).then(r => r.data)`. Read fresh on every call, so it's safe to pass a new closure on every render.
 * @param {Object} [options]
 * @param {number} [options.intervalMs] - Milliseconds between background polls. Omit (or pass a falsy value) to fetch once on mount only, with no polling.
 * @param {boolean} [options.pauseWhenHidden=true] - While true, a scheduled poll is skipped entirely (no fetch, timer keeps running on its normal schedule) whenever `document.hidden` is true.
 * @returns {{ data: any, loading: boolean, error: (Error|null), lastUpdatedAt: (number|null), refetch: () => void }}
 */
export function useAutoRefresh(fetchFn, { intervalMs, pauseWhenHidden = true } = {}) {
  const [data, setData] = useState(null);
  // Starts true via the initializer (never set back to true afterwards) so
  // callers can gate a Skeleton on it for the first paint only.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // "Latest ref" pattern: keeps the effect below from ever needing fetchFn
  // or pauseWhenHidden in its dependency array, so an interval isn't torn
  // down and rebuilt every render just because the caller passed a fresh
  // inline closure. Assigning inside an effect (not during render) keeps
  // this a plain ref write, not a state update, so it's unrelated to the
  // set-state-in-effect rule.
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });
  const pauseWhenHiddenRef = useRef(pauseWhenHidden);
  useEffect(() => {
    pauseWhenHiddenRef.current = pauseWhenHidden;
  });

  // No setState call here is synchronous: every one of them lives inside a
  // .then()/.catch()/.finally() continuation, per the shared contract's
  // pattern (b) for fetch-on-mount/interval effects.
  const runFetch = useCallback(() => {
    return fetchFnRef
      .current()
      .then((result) => {
        setData(result);
        setError(null);
        setLastUpdatedAt(Date.now());
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    runFetch();

    if (!intervalMs) {
      return undefined;
    }

    const id = setInterval(() => {
      if (pauseWhenHiddenRef.current && document.hidden) {
        return;
      }
      runFetch();
    }, intervalMs);

    return () => clearInterval(id);
  }, [runFetch, intervalMs]);

  return { data, loading, error, lastUpdatedAt, refetch: runFetch };
}

export default useAutoRefresh;
