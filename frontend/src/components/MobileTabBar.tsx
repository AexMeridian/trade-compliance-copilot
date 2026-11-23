import { NavLink, useLocation } from 'react-router-dom';

// Phone-width navigation: the five main pages as a bottom tab bar, so Hard Power, Soft Power and About are one tap away instead of
// behind a menu. Hidden from lg up, where the header shows the same links, and on printed case reports.
const TABS = [
  { to: '/today', label: 'Today', end: false },
  { to: '/', label: 'Wire', end: true },
  { to: '/hard-power', label: 'Hard Power', end: false },
  { to: '/soft-power', label: 'Soft Power', end: false },
  { to: '/calculator', label: 'Calculator', end: false },
];

export function MobileTabBar() {
  const { pathname } = useLocation();
  if (/^\/case\/[^/]+\/report$/.test(pathname)) return null;
  return (
    <nav aria-label="Main pages" className="no-print fixed inset-x-0 bottom-0 z-20 border-t-2 border-accent-2 bg-paper-raised pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <li key={t.to} className="min-w-0 flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex h-12 items-center justify-center px-1 text-center text-[12px] font-semibold leading-tight no-underline ${isActive ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`
              }
            >
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
