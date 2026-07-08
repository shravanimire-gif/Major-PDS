import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import useToast from '../ui/useToast';
import ThemeToggle from '../ui/ThemeToggle';
import Logo from '../ui/Logo';

const TopBar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [shopDetails, setShopDetails] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadShopDetails = async () => {
      try {
        const response = await api.get('/api/shopkeeper/me');

        if (!isMounted) {
          return;
        }

        setShopDetails(response.data);
      } catch (error) {
        if (isMounted) {
          setShopDetails(null);
          toast.danger(error.response?.data?.error || 'Failed to load shop details.');
        }
      }
    };

    loadShopDetails();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pds_token');
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="border-b border-chrome-hover bg-chrome-bg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/shopkeeper/dashboard" className="min-w-0">
          <Logo variant="dark" wordmark={false} />
          <h1 className="mt-1 truncate text-lg font-semibold text-chrome-text">{shopDetails?.shop?.name || 'Assigned Shop'}</h1>
          <p className="truncate text-sm text-chrome-text-muted">
            {shopDetails?.shop?.code ? `${shopDetails.shop.code} · ` : ''}
            {user?.email || 'shopkeeper@pds.gov'}
            {shopDetails?.shopkeeper?.mobile ? ` · ${shopDetails.shopkeeper.mobile}` : ''}
          </p>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle className="text-chrome-text-muted hover:bg-chrome-hover hover:text-chrome-text" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 items-center gap-2 rounded-sm bg-chrome-hover px-4 text-sm font-medium text-chrome-text transition hover:bg-chrome-active focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
