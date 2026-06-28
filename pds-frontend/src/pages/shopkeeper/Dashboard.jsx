import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const Dashboard = () => {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadMe = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await api.get('/api/shopkeeper/me');
        setData(response.data);
      } catch (loadError) {
        setError(loadError.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadMe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">Shopkeeper Dashboard</h1>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm"
          >
            Logout
          </button>
        </div>

        {loading ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-gray-400">Loading shop details...</div>
        ) : error ? (
          <div className="bg-red-900/40 border border-red-700 rounded-2xl p-4 text-red-300">{error}</div>
        ) : (
          <div className="space-y-5">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-3xl font-bold mb-2">{data?.shop?.name}</h2>
              <p className="text-gray-300 text-sm">Code: {data?.shop?.code}</p>
              <p className="text-gray-300 text-sm">Area: {data?.shop?.area}</p>
              <p className="text-gray-300 text-sm mt-3">Shopkeeper: {data?.shopkeeper?.name}</p>
              <p className="text-gray-400 text-sm">Email: {data?.shopkeeper?.email || '—'}</p>
              <p className="text-gray-400 text-sm">Mobile: {data?.shopkeeper?.mobile || '—'}</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Today transactions</p>
                <p className="text-2xl font-bold">{data?.today_transactions ?? 0}</p>
              </div>

              <Link
                to="/shopkeeper/scan"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold"
              >
                Start Scanning
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
