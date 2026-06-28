import { useEffect, useState } from 'react';
import api from '../../api/axios';

const filterClassName =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm';

const getCategoryBadgeClass = (category) => {
  if (category === 'APL') return 'bg-blue-900 text-blue-300';
  if (category === 'BPL') return 'bg-yellow-900 text-yellow-300';
  return 'bg-red-900 text-red-300';
};

const Beneficiaries = () => {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [areas, setAreas] = useState([]);
  const [shops, setShops] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    area_id: '',
    shop_id: '',
  });

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [areasResponse, shopsResponse] = await Promise.all([
          api.get('/api/admin/areas'),
          api.get('/api/admin/shops'),
        ]);

        setAreas(areasResponse.data?.areas || []);
        setShops(shopsResponse.data?.shops || shopsResponse.data?.data || []);
      } catch (fetchError) {
        setError(fetchError.response?.data?.error || 'Failed to load filters');
      }
    };

    fetchFilterData();
  }, []);

  useEffect(() => {
    const fetchBeneficiaries = async () => {
      setLoading(true);
      setError('');

      try {
        const params = {};
        if (filters.category) params.category = filters.category;
        if (filters.area_id) params.area_id = filters.area_id;
        if (filters.shop_id) params.shop_id = filters.shop_id;

        const response = await api.get('/api/admin/beneficiaries', { params });
        const payload = response.data || {};
        setBeneficiaries(payload.beneficiaries || payload.data || []);
        setTotal(payload.total || payload.pagination?.total || 0);
      } catch (fetchError) {
        setError(fetchError.response?.data?.error || 'Failed to load beneficiaries');
        setBeneficiaries([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBeneficiaries();
  }, [filters]);

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">Beneficiaries</h1>

      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          className={filterClassName}
          value={filters.category}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, category: event.target.value }))
          }
        >
          <option value="">All Categories</option>
          <option value="APL">APL</option>
          <option value="BPL">BPL</option>
          <option value="AAY">AAY</option>
        </select>

        <select
          className={filterClassName}
          value={filters.area_id}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, area_id: event.target.value }))
          }
        >
          <option value="">All Areas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>

        <select
          className={filterClassName}
          value={filters.shop_id}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, shop_id: event.target.value }))
          }
        >
          <option value="">All Shops</option>
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.shop_name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
          Showing {total} beneficiaries
        </span>
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
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Mobile</th>
              <th className="px-4 py-3 text-left">Card Number</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Shop</th>
              <th className="px-4 py-3 text-left">Area</th>
              <th className="px-4 py-3 text-left">Family Size</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : beneficiaries.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-gray-500">
                  No data found
                </td>
              </tr>
            ) : (
              beneficiaries.map((item, index) => (
                <tr
                  key={`${item.card_number}-${index}`}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="px-4 py-3 text-gray-200">{item.name}</td>
                  <td className="px-4 py-3 text-gray-200">{item.mobile || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{item.card_number}</td>
                  <td className="px-4 py-3 text-gray-200">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getCategoryBadgeClass(
                        item.category
                      )}`}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{item.shop_name}</td>
                  <td className="px-4 py-3 text-gray-200">{item.area_name}</td>
                  <td className="px-4 py-3 text-gray-200">{item.family_size}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Beneficiaries;
