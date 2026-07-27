import { useEffect } from 'react';
import { Anchor } from 'lucide-react';
import PanelHeader from '../../design/primitives/PanelHeader';
import AnchorStatusPill from '../../components/admin/AnchorStatusPill';
import EmptyState from '../../design/primitives/EmptyState';

const AnchorQueue = () => {
  useEffect(() => { document.title = 'Anchor Queue — PDS Supervision'; }, []);

  return (
    <>
      <PanelHeader title="Anchor Queue" />
      <div>
        <AnchorStatusPill />
      </div>
      <EmptyState
        icon={<Anchor size={32} />}
        title="No per-item anchor queue yet"
        description="Only an aggregate pending-anchor count is available today (shown above) — there is no endpoint yet to list individual queued or retryable anchor attempts."
      />
    </>
  );
};

export default AnchorQueue;
