import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';

// A thin replacement for raw useEffect+fetch, used only by this phase's new
// IoT admin pages (fleet/sessions/anomalies) — see PHASE3_DONE.md for why
// this exists instead of either retrofitting the rest of the admin section
// (unrelated refactor) or adding react-query (no query/cache library exists
// in this project). No cache, no background polling — pages refetch only on
// mount/param change or by calling refetch() explicitly after a mutation,
// matching the "never auto-refresh" UX rule. Fetch-on-mount via useEffect is
// the same pattern every existing admin page already uses (Shops.jsx,
// RationCards.jsx, Users.jsx).
const useApiQuery = (url, { params, enabled = true } = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState('');

    const paramsKey = params ? JSON.stringify(params) : '';

    const refetch = useCallback(async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        try {
            const response = await api.get(url, { params });
            setData(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, paramsKey]);

    useEffect(() => {
        if (enabled) {
            refetch();
        }
    }, [enabled, refetch]);

    return { data, loading, error, refetch };
};

export default useApiQuery;
