import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';

export default function ShopkeeperLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
