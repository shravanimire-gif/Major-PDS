import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import BulkUploadModal from '../../components/admin/BulkUploadModal';

const getCategoryBadgeClass = (category) => {
  if (category === 'APL') return 'bg-blue-900 text-blue-300';
  if (category === 'BPL') return 'bg-yellow-900 text-yellow-300';
  return 'bg-red-900 text-red-300';
};

const RationCards = () => {
  const navigate = useNavigate();
  const [rationCards, setRationCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);

  const fetchRationCards = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/ration-cards');
      setRationCards(response.data?.ration_cards || response.data?.data || []);
    } catch {
      setRationCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRationCards();
  }, []);

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Ration Cards</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm font-medium border border-gray-600 transition"
          >
            ↑ Bulk Upload
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/ration-cards/new')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition"
          >
            + Add Ration Card
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden mt-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : rationCards.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No ration cards yet.</p>
            <button
              type="button"
              onClick={() => navigate('/admin/ration-cards/new')}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium"
            >
              Add Ration Card
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Card Number</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Head Name</th>
                <th className="px-4 py-3 text-left">Shop</th>
                <th className="px-4 py-3 text-left">Area</th>
                <th className="px-4 py-3 text-left">Family Size</th>
                <th className="px-4 py-3 text-left">Rice (kg)</th>
                <th className="px-4 py-3 text-left">Wheat (kg)</th>
              </tr>
            </thead>
            <tbody>
              {rationCards.map((card) => (
                <tr
                  key={card.id}
                  className="border-t border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="px-4 py-3 text-gray-200">{card.card_number}</td>
                  <td className="px-4 py-3 text-gray-200">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getCategoryBadgeClass(
                        card.category
                      )}`}
                    >
                      {card.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{card.head_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{card.shop_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{card.area_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{card.family_size ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{card.rice_balance_kg ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-200">{card.wheat_balance_kg ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <BulkUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={fetchRationCards}
      />
    </div>
  );
};

export default RationCards;
