// eslint-disable-next-line no-unused-vars -- JSX below compiles to React.createElement in this test/build pipeline
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import cx from '../../components/ui/cx';

const DEFAULT_NAV_SECTIONS = [
  {
    title: 'OVERVIEW',
    items: [{ label: 'Dashboard', to: '/admin' }],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Devices', to: '/admin/operations/devices' },
      { label: 'Jobs', to: '/admin/operations/jobs' },
    ],
  },
  {
    title: 'HEALTH',
    items: [
      { label: 'Alerts', to: '/admin/health/alerts' },
      { label: 'Diagnostics', to: '/admin/health/diagnostics' },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'Users', to: '/admin/settings/users' },
      { label: 'Preferences', to: '/admin/settings/preferences' },
    ],
  },
];

/** Derives up to two initials (first + last name) from a display name, for the avatar circle. */
function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * The top-level admin page frame: a fixed-width left nav rail, a top bar
 * (breadcrumb + environment indicator + user menu trigger), and a
 * scrollable main content area. Every admin page is meant to render as
 * `children` inside this shell. It is standalone and not yet wired into
 * routing/App.jsx in this pass — a later pass supplies the real
 * `navSections` list and route-derived `breadcrumb`.
 *
 * Layout note: the main-content inner wrapper uses `max-w-[1440px]` with
 * no auto margins on purpose — it caps width on very large viewports but
 * stays flush against the left edge of the content area rather than
 * centering itself when the page content is narrower than 1440px.
 *
 * Below the `lg` breakpoint (1024px), the rail becomes an off-canvas drawer
 * opened via a hamburger button in the top bar, closed via its own X button,
 * an overlay click, or navigating to a new page.
 *
 * @param {Object} props
 * @param {Array<{ title: string, items: Array<{ label: string, to: string, icon?: React.ComponentType }> }>} [props.navSections] - Grouped navigation sections rendered in the left rail. `icon` is a component (e.g. a lucide-react icon), rendered at 16px. Defaults to a 4-group placeholder (OVERVIEW/OPERATIONS/HEALTH/SETTINGS) when omitted.
 * @param {React.ReactNode} [props.breadcrumb] - Rendered as-is on the left side of the top bar. This component never derives it from the current route itself.
 * @param {'production'|'staging'|'development'} [props.environment='production'] - The running environment. A warning-toned pill renders in the top bar whenever this is not 'production'.
 * @param {React.ReactNode} [props.topBarActions] - Extra controls rendered in the top bar, left of the environment pill/user menu (e.g. a theme toggle, a notification badge). Rendered as-is.
 * @param {{ name: string, email?: string }} [props.user] - The signed-in user. When provided, a user-menu trigger button (avatar initials + name) renders in the top bar; omitted entirely when there is no user.
 * @param {() => void} [props.onLogout] - Called when the user-menu button is activated. If omitted, the button still renders but does nothing (no dropdown is built yet — this is a single action trigger, not an account menu).
 * @param {React.ReactNode} props.children - Page content rendered inside the scrollable main area.
 */
function AppShell({
  navSections = DEFAULT_NAV_SECTIONS,
  breadcrumb,
  environment = 'production',
  topBarActions,
  user,
  onLogout,
  children,
}) {
  const initials = getInitials(user?.name);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const nav = (
    <nav aria-label="Main" className="flex-1 px-2 pb-4">
      {navSections.map((section) => (
        <div key={section.title} className="mt-3 first:mt-0">
          <div className="px-3 pb-1 text-ds-xs font-medium uppercase tracking-wide text-ds-text-tertiary">
            {section.title}
          </div>
          <ul>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2 border-l-2 py-2 px-3 text-ds-body',
                        'transition-colors duration-ds-fast ease-ds-standard',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface',
                        isActive
                          ? 'border-ds-accent bg-ds-surface-alt font-medium text-ds-text-primary'
                          : 'border-transparent text-ds-text-secondary hover:bg-ds-surface-alt'
                      )
                    }
                  >
                    {Icon ? (
                      <span aria-hidden="true">
                        <Icon size={16} />
                      </span>
                    ) : null}
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen bg-ds-canvas">
      {drawerOpen ? (
        <div
          data-testid="drawer-overlay"
          className="fixed inset-0 z-30 bg-ds-overlay/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cx(
          'flex w-60 flex-shrink-0 flex-col overflow-y-auto border-r border-ds-subtle bg-ds-surface',
          'fixed inset-y-0 left-0 z-40 transition-transform duration-ds-base ease-ds-standard lg:static lg:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-ds-title font-semibold text-ds-text-primary">PDS Supervision</span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className={cx(
              'rounded-ds-md p-1 text-ds-text-secondary hover:bg-ds-surface-alt lg:hidden',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
            )}
          >
            <X size={18} />
          </button>
        </div>

        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-ds-subtle bg-ds-surface px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className={cx(
                'rounded-ds-md p-1.5 text-ds-text-secondary hover:bg-ds-surface-alt lg:hidden',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
              )}
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">{breadcrumb}</div>
          </div>

          <div className="flex items-center gap-3">
            {topBarActions}

            {environment !== 'production' ? (
              <span className="rounded-ds-sm bg-ds-warning/10 px-2 py-0.5 text-ds-xs font-medium uppercase tracking-wide text-ds-warning">
                {environment}
              </span>
            ) : null}

            {user ? (
              <button
                type="button"
                aria-label={`Log out ${user.name}`}
                onClick={onLogout}
                className={cx(
                  'flex items-center gap-2 rounded-ds-md px-2 py-1',
                  'transition-colors duration-ds-fast ease-ds-standard hover:bg-ds-surface-alt',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ds-surface'
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ds-accent text-ds-xs font-medium text-ds-text-inverse"
                >
                  {initials}
                </span>
                <span className="text-ds-body text-ds-text-primary">{user.name}</span>
              </button>
            ) : null}
          </div>
        </header>

        <main id="app-shell-main" className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
