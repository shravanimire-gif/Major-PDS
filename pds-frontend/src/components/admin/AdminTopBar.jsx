import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdminHeaderValue } from '../../context/AdminHeaderContext';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';

const getInitials = (name, email) => {
  const source = (name || '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  return (email || '?').slice(0, 2).toUpperCase();
};

const AdminTopBar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { title, actions } = useAdminHeaderValue();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('pds_token');
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">
          Admin <span aria-hidden="true">&rsaquo;</span> <span className="text-text-primary">{title}</span>
        </p>
        <h1 className="truncate text-2xl font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions.map(({ key, label, icon: Icon, onClick, variant = 'secondary' }) => (
          <Button key={key || label} variant={variant} onClick={onClick}>
            {Icon && <Icon size={16} />}
            {label}
          </Button>
        ))}

        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {getInitials(user?.name, user?.email)}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-md)]"
            >
              <p className="truncate px-3 py-2 text-sm text-text-secondary">{user?.email || 'admin@pds.gov'}</p>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-danger-text transition hover:bg-danger-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AdminTopBar;
