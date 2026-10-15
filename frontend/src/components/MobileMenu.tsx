import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Phone-width header: Pulse and Calculator fit beside the logo, so the other main pages live here instead
// of being unreachable. Hidden from sm up, where the full nav shows.
const LINKS = [
  { to: '/abroad', label: 'U.S. abroad' },
  { to: '/allies', label: 'Dollar & allies' },
  { to: '/compare', label: 'Compare countries' },
  { to: '/about', label: 'About' },
  { to: '/methodology', label: 'Methodology and sources' },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <div ref={box} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label="More pages"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:text-ink"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="More pages" className="absolute right-0 top-10 z-30 w-60 border border-hairline bg-paper-raised py-1 shadow-xl">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="block px-4 py-2.5 text-sm font-semibold text-ink no-underline hover:bg-accent-soft">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
