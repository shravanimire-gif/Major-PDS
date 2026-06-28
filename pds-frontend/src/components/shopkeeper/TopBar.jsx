import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const TopBar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
        }
      }
    };

    loadShopDetails();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pds_token');
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="border-b border-gray-800 bg-gray-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <Link to="/shopkeeper/dashboard" className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
            PDS Shopkeeper
          </Link>
          <h1 className="truncate text-lg font-semibold text-white">
            {shopDetails?.shop?.name || 'Assigned Shop'}
          </h1>
          <p className="truncate text-sm text-gray-400">
            {shopDetails?.shop?.code ? `${shopDetails.shop.code} · ` : ''}
            {user?.email || 'shopkeeper@pds.gov'}
            {shopDetails?.shopkeeper?.mobile ? ` · ${shopDetails.shopkeeper.mobile}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default TopBar;
