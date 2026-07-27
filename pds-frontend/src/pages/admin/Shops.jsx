import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Plus, Store, Upload } from 'lucide-react';
import api from '../../api/axios';
import ShopBulkUploadModal from '../../components/admin/ShopBulkUploadModal';
import PanelHeader from '../../design/primitives/PanelHeader';
import useToast from '../../components/ui/useToast';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

const COLUMNS = [
  { label: 'Code' },
  { label: 'Shop Name' },
  { label: 'Area' },
  { label: 'Shopkeeper' },
  { label: 'Mobile' },
  { label: 'Beneficiaries', numeric: true },
  { label: 'Status' },
  { label: 'Actions' },
];

const emptyShopForm = { shop_code: '', shop_name: '', area_id: '' };

const Shops = () => {
  useEffect(() => { document.title = 'Shops — PDS Supervision'; }, []);
  const toast = useToast();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedShopId, setExpandedShopId] = useState(null);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showAddShop, setShowAddShop] = useState(false);
  const [shopForm, setShopForm] = useState(emptyShopForm);
  const [activeAreas, setActiveAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [shopSubmitting, setShopSubmitting] = useState(false);
  const [shopError, setShopError] = useState('');

  const fetchShops = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/shops');
      setShops(response.data?.shops || response.data?.data || []);
    } catch (fetchError) {
      toast.danger(fetchError.response?.data?.error || 'Failed to load shops');
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddShopModal = async () => {
    setShopForm(emptyShopForm);
    setShopError('');
    setShowAddShop(true);
    setLoadingAreas(true);
    try {
      const response = await api.get('/api/admin/areas?active_only=true');
      setActiveAreas(response.data?.areas || []);
    } catch {
      setShopError('Failed to load areas.');
    } finally {
      setLoadingAreas(false);
    }
  };

  const closeAddShopModal = () => {
    setShowAddShop(false);
    setShopForm(emptyShopForm);
    setShopError('');
    setActiveAreas([]);
  };

  const handleShopChange = (e) => {
    const { name, value } = e.target;
    setShopForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setShopError('');
    setShopSubmitting(true);
    try {
      await api.post('/api/admin/shops', shopForm);
      toast.success('Shop created successfully.');
      await fetchShops();
      closeAddShopModal();
    } catch (err) {
      setShopError(err.response?.data?.error || 'Failed to create shop.');
    } finally {
      setShopSubmitting(false);
    }
  };

  const [assignShop, setAssignShop] = useState(null);
  const [shopkeepers, setShopkeepers] = useState([]);
  const [loadingShopkeepers, setLoadingShopkeepers] = useState(false);
  const [selectedShopkeeper, setSelectedShopkeeper] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  const openAssignModal = async (shop, e) => {
    e.stopPropagation();
    setAssignShop(shop);
    setSelectedShopkeeper('');
    setAssignError('');
    setLoadingShopkeepers(true);
    try {
      const res = await api.get('/api/admin/shopkeepers/unassigned');
      setShopkeepers(res.data?.shopkeepers || []);
    } catch {
      setAssignError('Failed to load shopkeepers.');
    } finally {
      setLoadingShopkeepers(false);
    }
  };

  const closeAssignModal = () => {
    setAssignShop(null);
    setShopkeepers([]);
    setSelectedShopkeeper('');
    setAssignError('');
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShopkeeper) return;
    setAssignError('');
    setAssignSubmitting(true);
    try {
      await api.patch(`/api/admin/shops/${assignShop.id}/assign-shopkeeper`, {
        shopkeeper_id: selectedShopkeeper,
      });
      toast.success('Shopkeeper assigned successfully.');
      await fetchShops();
      closeAssignModal();
    } catch (err) {
      setAssignError(err.response?.data?.error || 'Failed to assign shopkeeper.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const toggleExpanded = (shopId) => {
    setExpandedShopId((prev) => (prev === shopId ? null : shopId));
  };

  const handleDeleteShop = async (shop, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${shop.shop_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/admin/shops/${shop.id}`);
      toast.success('Shop deleted successfully.');
      await fetchShops();
    } catch (err) {
      toast.danger(err.response?.data?.error || 'Failed to delete shop.');
    }
  };

  return (
    <>
      <PanelHeader
        title="Shops"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowBulkUpload(true)}>
              <Upload size={16} />
              Bulk Upload
            </Button>
            <Button variant="primary" onClick={openAddShopModal}>
              <Plus size={16} />
              Add Shop
            </Button>
          </div>
        }
      />
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
            <Table.LoadingRows rows={6} columns={COLUMNS.length} />
          ) : shops.length === 0 ? (
            <Table.Empty colSpan={COLUMNS.length}>
              <EmptyState
                icon={<Store size={20} />}
                title="No shops found"
                action={
                  <Button variant="primary" onClick={openAddShopModal}>
                    <Plus size={16} />
                    Add Shop
                  </Button>
                }
              />
            </Table.Empty>
          ) : (
            shops.map((shop) => {
              const isExpanded = expandedShopId === shop.id;

              return (
                <Fragment key={shop.id}>
                  <Table.Row className="cursor-pointer" onClick={() => toggleExpanded(shop.id)}>
                    <Table.Cell>{shop.shop_code}</Table.Cell>
                    <Table.Cell>{shop.shop_name}</Table.Cell>
                    <Table.Cell>{shop.area_name}</Table.Cell>
                    <Table.Cell>{shop.shopkeeper_name || <span className="text-text-disabled">—</span>}</Table.Cell>
                    <Table.Cell>{shop.shopkeeper_mobile || <span className="text-text-disabled">—</span>}</Table.Cell>
                    <Table.Cell numeric>{shop.beneficiary_count}</Table.Cell>
                    <Table.Cell>
                      <Badge status={shop.is_active ? 'success' : 'danger'} dot>
                        {shop.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/admin/shops/${shop.id}/live`}
                          className="flex items-center gap-1 rounded-sm text-xs font-medium text-text-secondary transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <Gauge size={14} />
                          Live weight
                        </Link>
                        {!shop.shopkeeper_name && (
                          <button
                            onClick={(e) => openAssignModal(shop, e)}
                            className="rounded-sm text-xs font-medium text-success-text transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                          >
                            Assign
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteShop(shop, e)}
                          className="rounded-sm text-xs font-medium text-danger-text transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          Delete
                        </button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                  {isExpanded && (
                    <tr className="border-t border-border">
                      <td colSpan={COLUMNS.length} className="bg-surface-muted px-6 py-4 text-sm text-text-secondary">
                        <div className="grid gap-2 md:grid-cols-3">
                          <p>
                            <span className="text-text-secondary">Shop Code:</span> {shop.shop_code}
                          </p>
                          <p>
                            <span className="text-text-secondary">Area:</span> {shop.area_name}
                          </p>
                          <p>
                            <span className="text-text-secondary">Shopkeeper:</span> {shop.shopkeeper_name || '—'}
                          </p>
                          <p>
                            <span className="text-text-secondary">Shopkeeper Mobile:</span> {shop.shopkeeper_mobile || '—'}
                          </p>
                          <p>
                            <span className="text-text-secondary">Beneficiaries:</span> {shop.beneficiary_count}
                          </p>
                          <p>
                            <span className="text-text-secondary">Status:</span>{' '}
                            <span className={shop.is_active ? 'text-success-text' : 'text-danger-text'}>
                              {shop.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </Table.Body>
      </Table>

      <Modal
        isOpen={Boolean(assignShop)}
        onClose={closeAssignModal}
        title="Assign Shopkeeper"
        footer={
          <>
            <Button variant="secondary" onClick={closeAssignModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="assign-shopkeeper-form"
              disabled={assignSubmitting || loadingShopkeepers || shopkeepers.length === 0 || !selectedShopkeeper}
            >
              {assignSubmitting ? 'Assigning…' : 'Assign Shopkeeper'}
            </Button>
          </>
        }
      >
        {assignShop && (
          <form id="assign-shopkeeper-form" onSubmit={handleAssignSubmit} className="space-y-4">
            <p className="text-sm text-text-secondary">
              Shop: <span className="font-medium text-text-primary">{assignShop.shop_name}</span>
            </p>

            {assignError && (
              <div className="rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
                {assignError}
              </div>
            )}

            <Select
              label="Select Shopkeeper"
              value={selectedShopkeeper}
              onChange={(e) => setSelectedShopkeeper(e.target.value)}
              required
              disabled={loadingShopkeepers}
              hint={
                !loadingShopkeepers && shopkeepers.length === 0
                  ? 'Create a shopkeeper first from the Users module.'
                  : undefined
              }
            >
              {loadingShopkeepers ? (
                <option value="">Loading...</option>
              ) : shopkeepers.length === 0 ? (
                <option value="">No unassigned shopkeepers available</option>
              ) : (
                <>
                  <option value="">Select a shopkeeper</option>
                  {shopkeepers.map((sk) => (
                    <option key={sk.id} value={sk.id}>
                      {sk.name || sk.email} {sk.mobile ? `— ${sk.mobile}` : ''}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </form>
        )}
      </Modal>

      <ShopBulkUploadModal isOpen={showBulkUpload} onClose={() => setShowBulkUpload(false)} onSuccess={fetchShops} />

      <Modal
        isOpen={showAddShop}
        onClose={closeAddShopModal}
        title="Add Shop"
        footer={
          <>
            <Button variant="secondary" onClick={closeAddShopModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="add-shop-form"
              disabled={shopSubmitting || loadingAreas || activeAreas.length === 0}
            >
              {shopSubmitting ? 'Creating…' : 'Create Shop'}
            </Button>
          </>
        }
      >
        <form id="add-shop-form" onSubmit={handleShopSubmit} className="space-y-4">
          {shopError && (
            <div className="rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
              {shopError}
            </div>
          )}

          <Input
            label="Shop Code"
            required
            name="shop_code"
            value={shopForm.shop_code}
            onChange={handleShopChange}
            maxLength={20}
            placeholder="e.g. DHR-001"
          />
          <Input
            label="Shop Name"
            required
            name="shop_name"
            value={shopForm.shop_name}
            onChange={handleShopChange}
            maxLength={150}
            placeholder="e.g. Dharmepad Shop 1"
          />
          <Select
            label="Area"
            required
            name="area_id"
            value={shopForm.area_id}
            onChange={handleShopChange}
            disabled={loadingAreas || activeAreas.length === 0}
          >
            {loadingAreas ? (
              <option value="">Loading areas...</option>
            ) : activeAreas.length === 0 ? (
              <option value="">No active areas available</option>
            ) : (
              <>
                <option value="">Select an area</option>
                {activeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </>
            )}
          </Select>
        </form>
      </Modal>
    </>
  );
};

export default Shops;
