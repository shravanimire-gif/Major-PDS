import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../../components/ui/useToast';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';

const Dashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadMe = async () => {
      setLoading(true);

      try {
        const response = await api.get('/api/shopkeeper/me');
        setData(response.data);
      } catch (loadError) {
        toast.danger(loadError.response?.data?.error || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold text-text-primary">Shopkeeper Dashboard</h1>

      {loading ? (
        <Skeleton.Card />
      ) : (
        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-semibold text-text-primary">{data?.shop?.name}</h2>
            <p className="mt-2 text-sm text-text-secondary">Code: {data?.shop?.code}</p>
            <p className="text-sm text-text-secondary">Area: {data?.shop?.area}</p>
            <p className="mt-3 text-sm text-text-secondary">Shopkeeper: {data?.shopkeeper?.name}</p>
            <p className="text-sm text-text-secondary">Email: {data?.shopkeeper?.email || '—'}</p>
            <p className="text-sm text-text-secondary">Mobile: {data?.shopkeeper?.mobile || '—'}</p>
          </Card>

          <Card bodyClassName="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Today transactions</p>
              <p className="text-2xl font-bold tabular-nums text-text-primary">{data?.today_transactions ?? 0}</p>
            </div>

            <Button variant="primary" className="h-11 px-6" onClick={() => navigate('/shopkeeper/scan')}>
              <QrCode size={16} />
              Start Scanning
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
