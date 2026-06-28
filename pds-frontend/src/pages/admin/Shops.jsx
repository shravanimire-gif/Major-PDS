import { Fragment, useEffect, useState } from 'react';
import api from '../../api/axios';
import ShopBulkUploadModal from '../../components/admin/ShopBulkUploadModal';

const emptyShopForm = { shop_code: '', shop_name: '', area_id: '' };

const Shops = () => {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedShopId, setExpandedShopId] = useState(null);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showAddShop, setShowAddShop] = useState(false);
  const [shopForm, setShopForm] = useState(emptyShopForm);
  const [activeAreas, setActiveAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [shopSubmitting, setShopSubmitting] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopSuccess, setShopSuccess] = useState('');

  const fetchShops = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/admin/shops');
      setShops(response.data?.shops || response.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.error || 'Failed to load shops');
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const openAddShopModal = async () => {
    setShopForm(emptyShopForm);
    setShopError('');
    setShopSuccess('');
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
    setShopSuccess('');
    setActiveAreas([]);
  };

  const handleShopChange = (e) => {
    const { name, value } = e.target;
    setShopForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleShopSubmit = async (e) => {
    e.preventDefault();
    setShopError('');
    setShopSuccess('');
    setShopSubmitting(true);
    try {
      await api.post('/api/admin/shops', shopForm);
      setShopSuccess('Shop created successfully.');
      await fetchShops();
      setTimeout(closeAddShopModal, 1200);
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
  const [assignSuccess, setAssignSuccess] = useState('');

  const openAssignModal = async (shop, e) => {
    e.stopPropagation();
    setAssignShop(shop);
    setSelectedShopkeeper('');
    setAssignError('');
    setAssignSuccess('');
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
    setAssignSuccess('');
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShopkeeper) return;
    setAssignError('');
    setAssignSuccess('');
    setAssignSubmitting(true);
    try {
      await api.patch(`/api/admin/shops/${assignShop.id}/assign-shopkeeper`, {
        shopkeeper_id: selectedShopkeeper,
      });
      setAssignSuccess('Shopkeeper assigned successfully.');
      await fetchShops();
      setTimeout(closeAssignModal, 1200);
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
      await fetchShops();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete shop.');
    }
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shops</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm font-medium border border-gray-600 transition"
          >
            ↑ Bulk Upload
          </button>
          <button
            onClick={openAddShopModal}
            className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            + Add Shop
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Shop Name</th>
              <th className="px-4 py-3 text-left">Area</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Shopkeeper</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Beneficiaries</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="text-center py-12 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : shops.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-12 text-gray-500">
                  No data found
                </td>
              </tr>
            ) : (
              shops.map((shop) => {
                const isExpanded = expandedShopId === shop.id;

                return (
                  <Fragment key={shop.id}>
                    <tr
                      className="border-t border-gray-800 hover:bg-gray-800/50 transition cursor-pointer"
                      onClick={() => toggleExpanded(shop.id)}
                    >
                      <td className="px-4 py-3 text-gray-200">{shop.shop_code}</td>
                      <td className="px-4 py-3 text-gray-200">{shop.shop_name}</td>
                      <td className="px-4 py-3 text-gray-200">{shop.area_name}</td>
                      <td className="px-4 py-3 text-gray-200">
                        {shop.contact_number || <span className="text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-200">
                        {shop.shopkeeper_name || <span className="text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-200">
                        {shop.shopkeeper_mobile || <span className="text-gray-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-200">{shop.beneficiary_count}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span className={`inline-block w-2 h-2 rounded-full ${shop.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                          <span className="text-gray-300">{shop.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          {!shop.shopkeeper_name && (
                            <button
                              onClick={(e) => openAssignModal(shop, e)}
                              className="text-green-400 hover:text-green-300 text-xs font-medium transition"
                            >
                              Assign
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDeleteShop(shop, e)}
                            className="text-red-400 hover:text-red-300 text-xs font-medium transition"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t border-gray-800">
                        <td colSpan="9" className="bg-gray-800 px-6 py-4 text-sm text-gray-300">
                          <div className="grid md:grid-cols-3 gap-2">
                            <p><span className="text-gray-400">Shop Code:</span> {shop.shop_code}</p>
                            <p><span className="text-gray-400">Area:</span> {shop.area_name}</p>
                            <p><span className="text-gray-400">Contact:</span> {shop.contact_number || '—'}</p>
                            <p><span className="text-gray-400">Shopkeeper:</span> {shop.shopkeeper_name || '—'}</p>
                            <p><span className="text-gray-400">Shopkeeper Mobile:</span> {shop.shopkeeper_mobile || '—'}</p>
                            <p><span className="text-gray-400">Beneficiaries:</span> {shop.beneficiary_count}</p>
                            <p>
                              <span className="text-gray-400">Status:</span>{' '}
                              <span className={shop.is_active ? 'text-green-400' : 'text-red-400'}>
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
          </tbody>
        </table>
      </div>
      {assignShop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="absolute inset-0" onClick={closeAssignModal} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold text-white">Assign Shopkeeper</h2>
              <button type="button" onClick={closeAssignModal} className="text-gray-400 hover:text-white transition">✕</button>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Shop: <span className="text-gray-200 font-medium">{assignShop.shop_name}</span>
            </p>

            {assignSuccess && (
              <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 text-green-300 text-sm mb-4">
                {assignSuccess}
              </div>
            )}
            {assignError && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-red-300 text-sm mb-4">
                {assignError}
              </div>
            )}

            <form onSubmit={handleAssignSubmit}>
              <label className="text-sm text-gray-400 mb-1 block" htmlFor="assign-shopkeeper">
                Select Shopkeeper
              </label>
              <select
                id="assign-shopkeeper"
                value={selectedShopkeeper}
                onChange={(e) => setSelectedShopkeeper(e.target.value)}
                required
                disabled={loadingShopkeepers}
                className={`bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition ${loadingShopkeepers ? 'opacity-50' : ''}`}
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
              </select>
              {!loadingShopkeepers && shopkeepers.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Create a shopkeeper first from the Users module.
                </p>
              )}

              <button
                type="submit"
                disabled={assignSubmitting || loadingShopkeepers || shopkeepers.length === 0 || !selectedShopkeeper}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 w-full font-medium text-sm transition mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignSubmitting ? 'Assigning...' : 'Assign Shopkeeper'}
              </button>
              <button
                type="button"
                onClick={closeAssignModal}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 w-full text-sm text-gray-300 transition mt-2"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      <ShopBulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={fetchShops}
      />

      {showAddShop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="absolute inset-0" onClick={closeAddShopModal} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">Add Shop</h2>
              <button
                type="button"
                onClick={closeAddShopModal}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {shopSuccess && (
              <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 text-green-300 text-sm mb-4">
                {shopSuccess}
              </div>
            )}
            {shopError && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-red-300 text-sm mb-4">
                {shopError}
              </div>
            )}

            <form onSubmit={handleShopSubmit}>
              <label className="text-sm text-gray-400 mb-1 block" htmlFor="shop-code">
                Shop Code
              </label>
              <input
                id="shop-code"
                name="shop_code"
                value={shopForm.shop_code}
                onChange={handleShopChange}
                required
                maxLength={20}
                placeholder="e.g. DHR-001"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
              />

              <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="shop-name">
                Shop Name
              </label>
              <input
                id="shop-name"
                name="shop_name"
                value={shopForm.shop_name}
                onChange={handleShopChange}
                required
                maxLength={150}
                placeholder="e.g. Dharmepad Shop 1"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
              />

              <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="shop-area">
                Area
              </label>
              <select
                id="shop-area"
                name="area_id"
                value={shopForm.area_id}
                onChange={handleShopChange}
                required
                disabled={loadingAreas || activeAreas.length === 0}
                className={`bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition ${
                  loadingAreas || activeAreas.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
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
              </select>

              <button
                type="submit"
                disabled={shopSubmitting || loadingAreas || activeAreas.length === 0}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 w-full font-medium text-sm transition mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shopSubmitting ? 'Creating...' : 'Create Shop'}
              </button>
              <button
                type="button"
                onClick={closeAddShopModal}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 w-full text-sm text-gray-300 transition mt-2"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shops;
