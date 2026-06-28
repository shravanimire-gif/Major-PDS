import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';

const emptyForm = { name: '', is_active: true };

const Areas = () => {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchAreas = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/api/admin/areas');
      setAreas(response.data?.areas || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.error || 'Failed to load areas');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

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

  const openAddModal = () => {
    setEditArea(null);
    setForm(emptyForm);
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  const openEditModal = (area) => {
    setEditArea(area);
    setForm({ name: area.name, is_active: area.is_active });
    setFormError('');
    setFormSuccess('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditArea(null);
    setForm(emptyForm);
    setFormError('');
    setFormSuccess('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      if (editArea) {
        await api.put(`/api/admin/areas/${editArea.id}`, form);
        setFormSuccess('Area updated successfully.');
      } else {
        await api.post('/api/admin/areas', form);
        setFormSuccess('Area created successfully.');
      }
      await fetchAreas();
      setTimeout(closeModal, 1200);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Areas</h1>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium transition"
        >
          + Add Area
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <p className="text-3xl font-bold text-white">{areas.length}</p>
          <p className="text-sm text-gray-400 mt-1">Total Areas</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <p className="text-3xl font-bold text-green-400">{summary.activeAreas}</p>
          <p className="text-sm text-gray-400 mt-1">Active Areas</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <p className="text-3xl font-bold text-white">{summary.totalShops}</p>
          <p className="text-sm text-gray-400 mt-1">Total Shops</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <p className="text-3xl font-bold text-white">{summary.totalBeneficiaries}</p>
          <p className="text-sm text-gray-400 mt-1">Total Beneficiaries</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search areas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-full max-w-sm focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Area Name</th>
              <th className="px-4 py-3 text-left">Shops</th>
              <th className="px-4 py-3 text-left">Beneficiaries</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-12 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-12 text-gray-500">
                  {search ? 'No areas match your search.' : 'No areas found.'}
                </td>
              </tr>
            ) : (
              filtered.map((area) => (
                <tr
                  key={area.id}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="px-4 py-3 text-gray-200 font-medium">{area.name}</td>
                  <td className="px-4 py-3 text-gray-200">{area.shop_count}</td>
                  <td className="px-4 py-3 text-gray-200">{area.beneficiary_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        area.is_active
                          ? 'bg-green-900/40 text-green-300 border border-green-800'
                          : 'bg-red-900/40 text-red-300 border border-red-800'
                      }`}
                    >
                      {area.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEditModal(area)}
                      className="text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="absolute inset-0" onClick={closeModal} aria-hidden="true" />
          <div className="relative w-full max-w-md bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">
                {editArea ? 'Edit Area' : 'Add Area'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {formSuccess && (
              <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 text-green-300 text-sm mb-4">
                {formSuccess}
              </div>
            )}
            {formError && (
              <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-red-300 text-sm mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label className="text-sm text-gray-400 mb-1 block" htmlFor="area-name">
                Area Name
              </label>
              <input
                id="area-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Dharmepad"
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
              />

              <div className="flex items-center gap-3 mt-5">
                <input
                  id="area-is-active"
                  name="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={handleChange}
                  className="w-4 h-4 accent-blue-500"
                />
                <label htmlFor="area-is-active" className="text-sm text-gray-300 select-none cursor-pointer">
                  Active
                </label>
              </div>

              {editArea && !form.is_active && Number(editArea.shop_count) > 0 && (
                <p className="text-xs text-yellow-400 mt-2">
                  This area has {editArea.shop_count} shop(s). Marking it inactive will hide it
                  from the shop creation dropdown.
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 w-full font-medium text-sm transition mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : editArea ? 'Update Area' : 'Create Area'}
              </button>
              <button
                type="button"
                onClick={closeModal}
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

export default Areas;
