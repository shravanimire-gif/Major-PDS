import { useEffect } from 'react';
import api from '../../api/axios';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import MetricTile from '../../design/patterns/MetricTile';
import RelativeTime from '../../design/patterns/RelativeTime';
import HashValue from '../../design/patterns/HashValue';
import { Card, PanelHeader, StatusPill, EmptyState, Skeleton, KeyValue } from '../../design/primitives';

// Maps the real /api/admin/blockchain/health `status` field (healthy |
// degraded | down, see pds-backend/src/services/blockchainHealthService.js)
// onto StatusPill's tone vocabulary (online | degraded | offline | unknown).
const STATUS_META = {
  healthy: { tone: 'online', label: 'Healthy' },
  degraded: { tone: 'degraded', label: 'Degraded' },
  down: { tone: 'offline', label: 'Down' },
};

// Low-balance threshold for the "Gas balance" metric tile's tone only. This
// is deliberately separate from the backend's own LOW_BALANCE_WARN_TX_COUNT
// (an estimated-transactions-remaining threshold used to derive the page's
// overall status) — 0.05 ETH is a simple, conservative "getting low" line
// for a Sepolia testnet wallet, picked here on the frontend for this tile.
const LOW_GAS_BALANCE_ETH = 0.05;

const BlockchainHealth = () => {
  useEffect(() => { document.title = 'Blockchain — PDS Supervision'; }, []);

  const { data: health, loading, error, lastUpdatedAt } = useAutoRefresh(
    () => api.get('/api/admin/blockchain/health').then((res) => res.data),
    { intervalMs: 10000 }
  );

  const statusMeta = (health && STATUS_META[health.status]) || null;

  const blockNumber = health?.rpc?.blockNumber;
  const contractAddress = health?.contract?.address;
  const balanceEth = health?.wallet?.balanceEth;
  const gasTone = balanceEth != null && Number(balanceEth) < LOW_GAS_BALANCE_ETH ? 'warning' : 'neutral';

  const configItems = health
    ? [
        contractAddress && { label: 'Contract address', value: <HashValue value={contractAddress} /> },
        health.wallet?.address && { label: 'Anchoring wallet address', value: <HashValue value={health.wallet.address} /> },
        health.contract?.totalRecords != null && {
          label: 'Total records on-chain',
          value: health.contract.totalRecords,
        },
      ].filter(Boolean)
    : [];

  return (
    <>
      <PanelHeader
        title="Blockchain"
        actions={
          loading ? (
            <Skeleton shape="text" width="5rem" height="1rem" />
          ) : statusMeta ? (
            <StatusPill status={statusMeta.tone} label={statusMeta.label} size="md" />
          ) : (
            <StatusPill status="unknown" label="Unknown" size="md" />
          )
        }
      />

      {!loading && !health ? (
        <EmptyState
          title="Blockchain health is unavailable"
          description={error?.message || 'The health endpoint could not be reached. It will keep retrying automatically.'}
        />
      ) : (
        <div className="space-y-6">
          {health?.reasons?.length > 0 && (
            <ul className="space-y-1">
              {health.reasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-ds-small text-ds-text-secondary">
                  <span aria-hidden="true" className="text-ds-text-disabled">&bull;</span>
                  {reason}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }, (_, i) => (
                <Card key={i}>
                  <Skeleton shape="text" width="40%" height="0.75rem" />
                  <Skeleton shape="text" width="60%" height="1.75rem" className="mt-3" />
                </Card>
              ))
            ) : (
              <>
                {/* No network/chain-name field exists anywhere in the health
                    response — see blockchainService.js's diagnostics shape —
                    so this tile is always a plain dash rather than an invented
                    "Sepolia" label. */}
                <MetricTile label="Chain" value="—" />
                <MetricTile label="Contract" value={contractAddress ? <HashValue value={contractAddress} /> : '—'} />
                <MetricTile
                  label="Latest block"
                  value={blockNumber != null ? blockNumber : '—'}
                  comparison={
                    blockNumber != null && health.checkedAt ? (
                      <>
                        as of <RelativeTime value={health.checkedAt} />
                      </>
                    ) : undefined
                  }
                />
                <MetricTile
                  label="Gas balance"
                  value={balanceEth != null ? `${Number(balanceEth).toFixed(4)} ETH` : '—'}
                  tone={gasTone}
                  comparison={
                    health.wallet?.estimatedTxRemaining != null
                      ? `~${health.wallet.estimatedTxRemaining} txs left at current gas price`
                      : undefined
                  }
                />
              </>
            )}
          </div>

          <Card>
            <PanelHeader title="Anchor throughput" />
            {loading ? (
              <Skeleton shape="block" height="8rem" />
            ) : (
              // No endpoint anywhere in the backend exposes a per-attempt
              // anchor list (dispense id / status / tx hash / gas used) — see
              // pds-backend/src/services/anchorStatusService.js, which only
              // returns aggregate counts, and activityFeedService.js, whose
              // anchor events are always successful (no failure/gas fields).
              // Documented gap: EmptyState instead of a fabricated table.
              <EmptyState
                title="No per-attempt anchor history available"
                description={`Only aggregate signals are exposed today: ${health.syncLag.lastHour.confirmed} confirmed and ${health.syncLag.lastHour.pending} pending anchor(s) in the last hour, ${health.failureRate.percentage.toFixed(1)}% failure rate${health.failureRate.sampleTooSmall ? ' (small sample)' : ''}. There is no backend endpoint yet that lists individual anchor attempts for a per-row table.`}
              />
            )}
          </Card>

          <Card>
            <PanelHeader title="Contract config" />
            {loading ? (
              <Skeleton shape="text" count={3} />
            ) : configItems.length > 0 ? (
              <KeyValue columns={2} items={configItems} />
            ) : (
              <EmptyState
                title="No contract config available"
                description="The blockchain service isn't configured (no contract address on file), so there's nothing to show here yet."
              />
            )}
          </Card>

          {lastUpdatedAt && (
            <p className="text-ds-xs text-ds-text-tertiary">
              Updated <RelativeTime value={lastUpdatedAt} />. Auto-refresh every 10 s.
              {error && ' Last refresh failed — showing last known data.'}
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default BlockchainHealth;
