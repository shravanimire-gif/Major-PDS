import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useFilterParams — keeps a list page's filter bar in sync with the URL
 * query string, so filters survive a refresh/back-button/shared link. Use
 * it in place of local `useState` for any set of filter controls (severity,
 * status, date range, …): pass the default value for each filter key once,
 * get back the currently-effective filters (URL value if present, default
 * otherwise) and an updater that merges partial changes back into the URL.
 * A key is written to the URL only when it differs from its default, so
 * "all filters at default" always reads as a clean URL with no query string.
 *
 * @param {Object<string, string>} defaults - Default value for every filter key this hook manages; its keys define which query params are read/written.
 * @returns {[Object<string, string>, (partial: Object<string, string>) => void]} `[filters, setFilters]` — `filters` is recomputed from the URL on every render; `setFilters(partial)` merges `partial` into the current filters and replaces the URL (no history entry).
 */
export function useFilterParams(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const result = {};
    for (const key of Object.keys(defaults)) {
      result[key] = searchParams.has(key) ? searchParams.get(key) : defaults[key];
    }
    return result;
  }, [searchParams, defaults]);

  const setFilters = useCallback(
    (partial) => {
      setSearchParams(
        (prevParams) => {
          const nextParams = new URLSearchParams(prevParams);
          for (const key of Object.keys(defaults)) {
            const current = prevParams.has(key) ? prevParams.get(key) : defaults[key];
            const next = Object.prototype.hasOwnProperty.call(partial, key) ? partial[key] : current;
            if (next === defaults[key] || next === undefined || next === null) {
              nextParams.delete(key);
            } else {
              nextParams.set(key, next);
            }
          }
          return nextParams;
        },
        { replace: true }
      );
    },
    [setSearchParams, defaults]
  );

  return [filters, setFilters];
}

export default useFilterParams;
