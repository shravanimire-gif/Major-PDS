import BlockchainHealthCard from '../../components/admin/BlockchainHealthCard';
import Card from '../../components/ui/Card';
import { usePageHeader } from '../../context/AdminHeaderContext';

const Dashboard = () => {
  usePageHeader('Dashboard');

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <BlockchainHealthCard />
      <Card header="Welcome">
        <p className="text-sm text-text-secondary">Manage your PDS system from here.</p>
      </Card>
    </div>
  );
};

export default Dashboard;
