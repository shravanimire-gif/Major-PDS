import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Users as UsersIcon, UserCog, Map, Store, Zap } from 'lucide-react';
import Logo from '../ui/Logo';
import cx from '../ui/cx';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/ration-cards', label: 'Ration Cards', icon: CreditCard },
  { to: '/admin/beneficiaries', label: 'Beneficiaries', icon: UsersIcon },
  { to: '/admin/users', label: 'Users', icon: UserCog },
  { to: '/admin/areas', label: 'Areas', icon: Map },
  { to: '/admin/shops', label: 'Shops', icon: Store },
  { to: '/admin/entitlements', label: 'Entitlements', icon: Zap },
];

const Sidebar = () => {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-chrome-bg text-chrome-text">
      <div className="flex h-16 items-center px-5">
        <Logo variant="dark" />
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2 text-sm font-medium">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx(
                'relative flex items-center gap-3 rounded-sm px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                isActive
                  ? 'bg-chrome-active text-chrome-text'
                  : 'text-chrome-text-muted hover:bg-chrome-hover hover:text-chrome-text'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cx(
                    'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-sm bg-brand-500 transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                  aria-hidden="true"
                />
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
