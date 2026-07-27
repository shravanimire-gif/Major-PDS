import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ToastProvider from './components/ui/Toast';
import ThemeToggle from './components/ui/ThemeToggle';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import AppShell from './design/layouts/AppShell';
import { Breadcrumb } from './design/primitives';
import { ADMIN_NAV_SECTIONS, getBreadcrumbItems, getSectionForPath } from './config/adminNav';
import CommandPalette from './components/admin/CommandPalette';
import AnomalyBadge from './components/admin/AnomalyBadge';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

// Admin imports
import AdminDashboard from './pages/admin/Dashboard';
import RationCards from './pages/admin/RationCards';
import AddRationCard from './pages/admin/AddRationCard';
import Beneficiaries from './pages/admin/Beneficiaries';
import Dispenses from './pages/admin/Dispenses';
import DispenseDetail from './pages/admin/DispenseDetail';
import Wallets from './pages/admin/Wallets';
import Users from './pages/admin/Users';
import Areas from './pages/admin/Areas';
import Shops from './pages/admin/Shops';
import ShopLiveWeight from './pages/admin/ShopLiveWeight';
import IotFleet from './pages/admin/IotFleet';
import BlockchainHealth from './pages/admin/BlockchainHealth';
import AnchorQueue from './pages/admin/AnchorQueue';
import Anomalies from './pages/admin/Anomalies';
import AuditLog from './pages/admin/AuditLog';
import Entitlements from './pages/admin/Entitlements';
import CommodityTolerances from './pages/admin/CommodityTolerances';
import Devices from './pages/admin/Devices';

// Shopkeeper imports
import ShopkeeperDashboard from './pages/shopkeeper/Dashboard';
import ScanAndDispense from './pages/shopkeeper/ScanAndDispense';
import ShopkeeperLayout from './components/shopkeeper/Layout';

const ENVIRONMENT = import.meta.env.MODE === 'production' ? 'production' : import.meta.env.MODE;

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const previousSectionRef = useRef(getSectionForPath(location.pathname));

  useGlobalShortcuts({ onOpenPalette: () => setPaletteOpen(true) });

  // Reset scroll to top only when moving between IA sections (e.g. Operations ->
  // Health); preserve scroll position when navigating within the same section.
  useEffect(() => {
    const section = getSectionForPath(location.pathname);
    if (section !== previousSectionRef.current) {
      document.getElementById('app-shell-main')?.scrollTo({ top: 0 });
      previousSectionRef.current = section;
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <AppShell
        navSections={ADMIN_NAV_SECTIONS}
        breadcrumb={<Breadcrumb items={getBreadcrumbItems(location.pathname)} />}
        environment={ENVIRONMENT}
        topBarActions={
          <div className="flex items-center gap-1">
            <AnomalyBadge />
            <ThemeToggle />
          </div>
        }
        user={user ? { name: user.name || user.email, email: user.email } : undefined}
        onLogout={handleLogout}
      >
        <Outlet />
      </AppShell>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
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
              {/* OVERVIEW */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />

              {/* OPERATIONS */}
              <Route path="/admin/shops" element={<Shops />} />
              <Route path="/admin/shops/:shopId/live" element={<ShopLiveWeight />} />
              <Route path="/admin/beneficiaries" element={<Beneficiaries />} />
              <Route path="/admin/dispenses" element={<Dispenses />} />
              <Route path="/admin/dispenses/:id" element={<DispenseDetail />} />
              <Route path="/admin/wallets" element={<Wallets />} />
              <Route path="/admin/ration-cards" element={<RationCards />} />
              <Route path="/admin/ration-cards/new" element={<AddRationCard />} />
              <Route path="/admin/entitlements" element={<Entitlements />} />
              <Route path="/admin/areas" element={<Areas />} />

              {/* HEALTH */}
              <Route path="/admin/health/blockchain" element={<BlockchainHealth />} />
              <Route path="/admin/health/iot" element={<IotFleet />} />
              <Route path="/admin/health/anchors" element={<AnchorQueue />} />

              {/* INCIDENTS */}
              <Route path="/admin/anomalies" element={<Anomalies />} />
              <Route path="/admin/audit" element={<AuditLog />} />

              {/* SETTINGS */}
              <Route path="/admin/settings/users" element={<Users />} />
              <Route path="/admin/settings/tolerances" element={<CommodityTolerances />} />
              <Route path="/admin/settings/devices" element={<Devices />} />

              {/* Legacy redirects: old paths kept working, nothing 404s */}
              <Route path="/admin/iot/fleet" element={<Navigate to="/admin/health/iot" replace />} />
              <Route path="/admin/iot/sessions" element={<Navigate to="/admin/dispenses" replace />} />
              <Route path="/admin/iot/sessions/:id" element={<LegacySessionRedirect />} />
              <Route path="/admin/users" element={<Navigate to="/admin/settings/users" replace />} />
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

/** /admin/iot/sessions/:id had a dynamic segment, so it needs its own tiny redirect component rather than a static <Navigate to> string. */
function LegacySessionRedirect() {
  const location = useLocation();
  const id = location.pathname.split('/').pop();
  return <Navigate to={`/admin/dispenses/${id}`} replace />;
}

export default App;
