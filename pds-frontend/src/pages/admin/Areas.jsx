import { useEffect, useMemo, useState } from 'react';
import { Map, Plus } from 'lucide-react';
import api from '../../api/axios';
import { usePageHeader } from '../../context/AdminHeaderContext';
import useToast from '../../components/ui/useToast';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';

const COLUMNS = [
  { label: 'Area Name' },
  { label: 'Shops', numeric: true },
  { label: 'Beneficiaries', numeric: true },
  { label: 'Status' },
  { label: 'Actions' },
];

const emptyForm = { name: '', is_active: true };

const Areas = () => {
  const toast = useToast();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/areas');
      setAreas(response.data?.areas || []);
    } catch (fetchError) {
      toast.danger(fetchError.response?.data?.error || 'Failed to load areas');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setEditArea(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  usePageHeader('Areas', [{ key: 'add', label: 'Add Area', icon: Plus, variant: 'primary', onClick: openAddModal }]);

  const filtered = useMemo(() => {
    if (!search.trim()) return areas;
    const q = search.toLowerCase();
    return areas.filter((a) => a.name.toLowerCase().includes(q));
  }, [areas, search]);

  const summary = useMemo(() => {
    return areas.reduce(
      (acc, area) => {
        acc.totalShops += Number(area.shop_count || 0);
        acc.totalBeneficiaries += Number(area.beneficiary_count || 0);
        if (area.is_active) acc.activeAreas += 1;
        return acc;
      },
      { totalShops: 0, totalBeneficiaries: 0, activeAreas: 0 },
    );
  }, [areas]);

  const openEditModal = (area) => {
    setEditArea(area);
    setForm({ name: area.name, is_active: area.is_active });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditArea(null);
    setForm(emptyForm);
    setFormError('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editArea) {
        await api.put(`/api/admin/areas/${editArea.id}`, form);
        toast.success('Area updated successfully.');
      } else {
        await api.post('/api/admin/areas', form);
        toast.success('Area created successfully.');
      }
      await fetchAreas();
      closeModal();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card bodyClassName="p-5">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{areas.length}</p>
          <p className="mt-1 text-sm text-text-secondary">Total Areas</p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-2xl font-bold tabular-nums text-success-text">{summary.activeAreas}</p>
          <p className="mt-1 text-sm text-text-secondary">Active Areas</p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{summary.totalShops}</p>
          <p className="mt-1 text-sm text-text-secondary">Total Shops</p>
        </Card>
        <Card bodyClassName="p-5">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{summary.totalBeneficiaries}</p>
          <p className="mt-1 text-sm text-text-secondary">Total Beneficiaries</p>
        </Card>
      </div>

      <Input placeholder="Search areas..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Table>
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
          {loading ? (
            <Table.LoadingRows rows={5} columns={COLUMNS.length} />
          ) : filtered.length === 0 ? (
            <Table.Empty colSpan={COLUMNS.length}>
              <EmptyState
                icon={<Map size={20} />}
                title={search ? 'No areas match your search' : 'No areas found'}
                action={
                  !search && (
                    <Button variant="primary" onClick={openAddModal}>
                      <Plus size={16} />
                      Add Area
                    </Button>
                  )
                }
              />
            </Table.Empty>
          ) : (
            filtered.map((area) => (
              <Table.Row key={area.id}>
                <Table.Cell className="font-medium">{area.name}</Table.Cell>
                <Table.Cell numeric>{area.shop_count}</Table.Cell>
                <Table.Cell numeric>{area.beneficiary_count}</Table.Cell>
                <Table.Cell>
                  <Badge status={area.is_active ? 'success' : 'danger'}>{area.is_active ? 'Active' : 'Inactive'}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <button
                    onClick={() => openEditModal(area)}
                    className="text-xs font-medium text-brand-500 transition hover:text-brand-600"
                  >
                    Edit
                  </button>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editArea ? 'Edit Area' : 'Add Area'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="area-form" disabled={submitting}>
              {submitting ? 'Saving…' : editArea ? 'Update Area' : 'Create Area'}
            </Button>
          </>
        }
      >
        <form id="area-form" onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
              {formError}
            </div>
          )}

          <Input
            label="Area Name"
            required
            name="name"
            value={form.name}
            onChange={handleChange}
            minLength={2}
            maxLength={100}
            placeholder="e.g. Dharmepad"
          />

          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              name="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={handleChange}
              className="h-4 w-4 accent-brand-500"
            />
            Active
          </label>

          {editArea && !form.is_active && Number(editArea.shop_count) > 0 && (
            <p className="text-xs text-warning-text">
              This area has {editArea.shop_count} shop(s). Marking it inactive will hide it from the shop creation
              dropdown.
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default Areas;
