import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleX, RefreshCw } from 'lucide-react';
import api from '../../api/axios';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';

// Matches the backend's HEALTH_CACHE_TTL_MS (see pds-backend/src/config/blockchainHealth.js) —
// polling faster than the cache TTL would just re-fetch the same cached payload.
const REFRESH_INTERVAL_MS = 60_000;

const STATUS_META = {
  healthy: { status: 'success', icon: CircleCheck, label: 'Healthy' },
  degraded: { status: 'warning', icon: CircleAlert, label: 'Degraded' },
  down: { status: 'danger', icon: CircleX, label: 'Down' },
};

const formatDateTime = (iso) => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const Stat = ({ label, value, sub }) => (
  <div>
    <p className="break-words text-lg font-bold tabular-nums text-text-primary">{value}</p>
    <p className="mt-0.5 text-xs text-text-secondary">{label}</p>
    {sub && <p className="mt-0.5 text-xs text-text-disabled">{sub}</p>}
  </div>
);

const BlockchainHealthCard = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef(null);

  const fetchHealth = useCallback(async ({ manual = false, forceRefresh = false } = {}) => {
    if (manual) setRefreshing(true);
    try {
      const response = await api.get('/api/admin/blockchain/health', {
        params: forceRefresh ? { refresh: 'true' } : undefined,
      });
      setHealth(response.data);
      setError('');
    } catch (fetchError) {
      setError(fetchError.response?.data?.error || 'Failed to load blockchain health');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    intervalRef.current = setInterval(() => fetchHealth(), REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchHealth]);

  const statusKey = health?.status && STATUS_META[health.status] ? health.status : 'down';
  const meta = STATUS_META[statusKey];
  const StatusIcon = meta.icon;

  return (
    <Card className="col-span-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Blockchain Integration</h2>
          <Badge status={meta.status} icon={<StatusIcon size={13} />} title={health?.reasons?.join('; ') || 'All systems normal'}>
            {meta.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {health?.cache && (
            <span className="text-xs text-text-secondary">
              {health.cache.cached ? `cached ${Math.round(health.cache.ageMs / 1000)}s ago` : 'just checked'}
              {health.stale && ' (stale — last check failed)'}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchHealth({ manual: true, forceRefresh: true })}
            disabled={refreshing}
            aria-label="Refresh blockchain health"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition hover:bg-surface-muted hover:text-text-primary disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? 'Hide health details' : 'Show health details'}
            aria-expanded={expanded}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition hover:bg-surface-muted hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton.Text width="w-2/3" />
          <Skeleton.Text width="w-1/2" />
        </div>
      ) : error ? (
        <p className="mt-3 text-sm text-danger-text">{error}</p>
      ) : (
        <>
          {health.reasons?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {health.reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-sm text-text-secondary">
                  <span className="text-text-disabled">&bull;</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}

          {expanded && (
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-4 md:grid-cols-4">
              <Stat
                label="Pending anchor (1h)"
                value={health.syncLag.lastHour.pending}
                sub={`${health.syncLag.lastHour.confirmed} confirmed`}
              />
              <Stat
                label="Pending anchor (24h)"
                value={health.syncLag.last24Hours.pending}
                sub={`${health.syncLag.last24Hours.confirmed} confirmed`}
              />
              <Stat
                label="Failure rate (1h)"
                value={`${health.failureRate.percentage.toFixed(1)}%`}
                sub={`${health.failureRate.failures} of ${health.failureRate.attempts} attempts${
                  health.failureRate.sampleTooSmall ? ' — low sample' : ''
                }`}
              />
              <Stat
                label="Deployer wallet balance"
                value={health.wallet.balanceEth ? `${Number(health.wallet.balanceEth).toFixed(4)} ETH` : 'Unavailable'}
                sub={
                  health.wallet.estimatedTxRemaining != null
                    ? `~${health.wallet.estimatedTxRemaining} txs left at current gas price`
                    : health.wallet.error
                }
              />
              <Stat
                label="RPC connectivity"
                value={health.rpc.reachable ? `${health.rpc.latencyMs}ms` : 'Unreachable'}
                sub={health.rpc.reachable ? `block #${health.rpc.blockNumber}` : health.rpc.error}
              />
              <Stat
                label="Contract reachability"
                value={health.contract.reachable ? 'Reachable' : 'Unreachable'}
                sub={health.contract.reachable ? `${health.contract.totalRecords} total records on-chain` : health.contract.error}
              />
              <Stat
                label="Last successful anchor"
                value={health.lastSuccessfulAnchor ? formatDateTime(health.lastSuccessfulAnchor.at) : 'None yet'}
                sub={health.lastSuccessfulAnchor ? `${health.lastSuccessfulAnchor.txHash.slice(0, 12)}…` : ''}
              />
              <div className="flex items-end text-xs text-text-secondary">
                Per-failure error details live in the backend's logs (logs/error.log) — there's no in-app failure log view yet.
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default BlockchainHealthCard;
