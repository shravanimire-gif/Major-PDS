import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Zap } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../../components/ui/useToast';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import PanelHeader from '../../design/primitives/PanelHeader';

const COLUMNS = [
  { label: 'Card Number' },
  { label: 'Category' },
  { label: 'Family Size', numeric: true },
  { label: 'Rice (kg)', numeric: true },
  { label: 'Wheat (kg)', numeric: true },
  { label: 'Sugar (kg)', numeric: true },
];

const getCategoryBadgeStatus = (category) => {
  if (category === 'APL') return 'info';
  if (category === 'BPL') return 'warning';
  return 'danger';
};

const formatLastAllocated = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const Entitlements = () => {
  useEffect(() => { document.title = 'Entitlements — PDS Supervision'; }, []);
  const toast = useToast();

  const [preview, setPreview] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastAllocated, setLastAllocated] = useState('');

  const totals = useMemo(() => {
    return preview.reduce(
      (acc, row) => ({
        cards: acc.cards + 1,
        rice: acc.rice + Number(row.rice_kg || 0),
        wheat: acc.wheat + Number(row.wheat_kg || 0),
        sugar: acc.sugar + Number(row.sugar_kg || 0),
      }),
      { cards: 0, rice: 0, wheat: 0, sugar: 0 },
    );
  }, [preview]);

  const loadPreview = async () => {
    setPreviewVisible(true);
    setPreviewLoading(true);

    try {
      const { data } = await api.get('/api/admin/entitlements/preview');
      const rows = data?.preview || [];
      setPreview(rows);
      setLastAllocated(rows[0]?.last_reset_date || '');
    } catch (err) {
      setPreview([]);
      toast.danger(err.response?.data?.detail || 'Failed to load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmAllocation = async () => {
    setConfirmOpen(false);
    setAllocating(true);

    try {
      const { data } = await api.post('/api/admin/entitlements/allocate');
      toast.success(`Allocation complete! ${data?.processed || 0} cards updated.`);
      await loadPreview();
    } catch (err) {
      toast.danger(err.response?.data?.detail || err.response?.data?.error || 'Allocation failed.');
    } finally {
      setAllocating(false);
    }
  };

  return (
    <>
      <PanelHeader title="Entitlements" />
      <div className="space-y-4">
        <p className="-mt-4 text-sm text-text-secondary">Preview and allocate monthly rations for all active cards</p>

        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={loadPreview} disabled={previewLoading || allocating}>
            {previewLoading ? 'Loading preview…' : 'Preview Allocation'}
          </Button>

          <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={allocating || previewLoading}>
            <Zap size={16} />
            {allocating ? 'Allocating…' : 'Allocate Monthly Ration'}
          </Button>

          {lastAllocated && <span className="text-xs text-text-secondary">Last allocated: {formatLastAllocated(lastAllocated)}</span>}
        </div>

        {previewVisible && (
          <Table
            footer={
              preview.length > 0 && !previewLoading ? (
                <div className="px-4 py-3 text-xs font-medium text-text-secondary">
                  Total: {totals.cards} cards | {totals.rice.toFixed(2)} kg rice | {totals.wheat.toFixed(2)} kg wheat |{' '}
                  {totals.sugar.toFixed(2)} kg sugar
                </div>
              ) : null
            }
          >
            <Table.Head>
              <tr>
                {COLUMNS.map((col) => (
                  <Table.Cell header key={col.label} numeric={col.numeric}>
                    {col.label}
                  </Table.Cell>
                ))}
              </tr>
            </Table.Head>
            <Table.Body>
              {previewLoading ? (
                <Table.LoadingRows rows={5} columns={COLUMNS.length} />
              ) : preview.length === 0 ? (
                <Table.Empty colSpan={COLUMNS.length}>
                  <EmptyState icon={<CreditCard size={20} />} title="No active ration cards found" />
                </Table.Empty>
              ) : (
                preview.map((row) => (
                  <Table.Row key={row.ration_card_id}>
                    <Table.Cell>{row.card_number}</Table.Cell>
                    <Table.Cell>
                      <Badge status={getCategoryBadgeStatus(row.category)}>{row.category}</Badge>
                    </Table.Cell>
                    <Table.Cell numeric>{row.family_size}</Table.Cell>
                    <Table.Cell numeric>
                      {row.category === 'AAY' ? <span className="italic text-text-disabled">35 (fixed)</span> : row.rice_kg}
                    </Table.Cell>
                    <Table.Cell numeric>{row.wheat_kg}</Table.Cell>
                    <Table.Cell numeric>{row.sugar_kg}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        )}

        <Modal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Confirm Monthly Allocation"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmAllocation}>
                Confirm Allocation
              </Button>
            </>
          }
        >
          <p className="text-sm text-text-secondary">
            This will reset all wallet balances based on current family sizes and policies. This cannot be undone.
          </p>
        </Modal>
      </div>
    </>
  );
};

export default Entitlements;
