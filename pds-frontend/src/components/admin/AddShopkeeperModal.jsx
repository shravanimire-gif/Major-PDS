import { useEffect, useState } from 'react';
import api from '../../api/axios';

const emptyForm = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  shop_id: '',
};

const AddShopkeeperModal = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState(emptyForm);
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isMounted = true;

    const loadUnassignedShops = async () => {
      setForm(emptyForm);
      setShops([]);
      setError('');
      setSuccess('');
      setLoadingShops(true);

      try {
        const response = await api.get('/api/admin/shops?unassigned=true');
        if (!isMounted) {
          return;
        }
        setShops(response.data?.shops || response.data?.data || []);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }
        setError(fetchError.response?.data?.error || 'Failed to load available shops.');
      } finally {
        if (isMounted) {
          setLoadingShops(false);
        }
      }
    };

    loadUnassignedShops();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const closeAndReset = () => {
    setForm(emptyForm);
    setError('');
    setSuccess('');
    onClose();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      await api.post('/api/admin/shopkeepers', form);
      setSuccess('✓ Shopkeeper added successfully!');
      setTimeout(() => {
        closeAndReset();
        onSuccess();
      }, 1500);
    } catch (submitError) {
      const data = submitError.response?.data;
      const msg = data?.details?.join(', ') || data?.error || 'Failed to create shopkeeper.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const noUnassignedShops = !loadingShops && shops.length === 0;
  const isSubmitDisabled = submitting || loadingShops;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="absolute inset-0"
        onClick={closeAndReset}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl p-8 border border-gray-800 shadow-2xl opacity-100 transition-opacity duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">Add Shopkeeper</h2>
          <button
            type="button"
            onClick={closeAndReset}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {success && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl p-3 text-green-300 text-sm mb-4">
            {success}
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl p-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="text-sm text-gray-400 mb-1 block" htmlFor="shopkeeper-name">
            Full Name
          </label>
          <input
            id="shopkeeper-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
          />

          <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="shopkeeper-email">
            Email
          </label>
          <input
            id="shopkeeper-email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
          />

          <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="shopkeeper-mobile">
            Mobile
          </label>
          <input
            id="shopkeeper-mobile"
            name="mobile"
            value={form.mobile}
            onChange={handleChange}
            placeholder="Mobile number"
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
          />

          <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="shopkeeper-password">
            Password
          </label>
          <input
            id="shopkeeper-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            minLength={6}
            required
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition"
          />

          <label className="text-sm text-gray-400 mb-1 block mt-4" htmlFor="shopkeeper-shop">
            Shop <span className="text-gray-600">(optional)</span>
          </label>
          <select
            id="shopkeeper-shop"
            name="shop_id"
            value={form.shop_id}
            onChange={handleChange}
            disabled={loadingShops}
            className={`bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition ${
              loadingShops ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loadingShops ? (
              <option value="">Loading shops...</option>
            ) : (
              <>
                <option value="">— No shop (assign later) —</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.shop_name} — {shop.area_name}
                  </option>
                ))}
              </>
            )}
          </select>

          {noUnassignedShops && !loadingShops && (
            <p className="text-xs text-gray-500 mt-1">No unassigned shops yet. You can assign a shop later.</p>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2 w-full font-medium text-sm transition mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding...' : 'Add Shopkeeper'}
          </button>

          <button
            type="button"
            onClick={closeAndReset}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 w-full text-sm text-gray-300 transition mt-2"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddShopkeeperModal;
