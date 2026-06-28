import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';

// Admin imports
import AdminDashboard from './pages/admin/Dashboard';
import RationCards from './pages/admin/RationCards';
import AddRationCard from './pages/admin/AddRationCard';
import Beneficiaries from './pages/admin/Beneficiaries';
import Users from './pages/admin/Users';
import Areas from './pages/admin/Areas';
import Shops from './pages/admin/Shops';
import Entitlements from './pages/admin/Entitlements';
import AdminSidebar from './components/admin/Sidebar';

// Shopkeeper imports
import ShopkeeperDashboard from './pages/shopkeeper/Dashboard';
import ScanAndDispense from './pages/shopkeeper/ScanAndDispense';
import ShopkeeperLayout from './components/shopkeeper/Layout';

function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-900">
      <AdminSidebar />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/ration-cards" element={<RationCards />} />
              <Route path="/admin/ration-cards/new" element={<AddRationCard />} />
              <Route path="/admin/beneficiaries" element={<Beneficiaries />} />
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/areas" element={<Areas />} />
              <Route path="/admin/shops" element={<Shops />} />
              <Route path="/admin/entitlements" element={<Entitlements />} />
            </Route>
          </Route>

          {/* Shopkeeper Routes */}
          <Route element={<ProtectedRoute allowedRoles={['shopkeeper']} />}>
            <Route element={<ShopkeeperLayout />}>
              <Route path="/shopkeeper/dashboard" element={<ShopkeeperDashboard />} />
              <Route path="/shopkeeper/scan" element={<ScanAndDispense />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
