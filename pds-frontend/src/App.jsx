import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminHeaderProvider } from './context/AdminHeaderContext';
import ToastProvider from './components/ui/Toast';
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
import AdminTopBar from './components/admin/AdminTopBar';

// Shopkeeper imports
import ShopkeeperDashboard from './pages/shopkeeper/Dashboard';
import ScanAndDispense from './pages/shopkeeper/ScanAndDispense';
import ShopkeeperLayout from './components/shopkeeper/Layout';

function AdminLayout() {
  return (
    <AdminHeaderProvider>
      <div className="flex h-screen bg-surface-muted">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminTopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminHeaderProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
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
    </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
