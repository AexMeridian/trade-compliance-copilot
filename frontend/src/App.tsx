import { useRef } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { CaseWizard } from './pages/CaseWizard';
import { Report } from './pages/Report';
import { Pulse } from './pages/Pulse';

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-ink">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 2v4.5M12 17.5V22M2 12h4.5M17.5 12H22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#data-sources', label: 'Data sources' },
  { href: '#samples', label: 'Sample cases' },
];

function DesktopNav() {
  return (
    <nav className="hidden items-center gap-x-7 font-sans text-sm sm:flex">
      {NAV_LINKS.map((l) => (
        <a key={l.href} href={l.href} className="text-ink-muted no-underline hover:text-ink">
          {l.label}
        </a>
      ))}
      <a href="#start" className="border border-accent px-3.5 py-1.5 text-sm text-accent no-underline hover:bg-accent-soft">
        Start a case
      </a>
    </nav>
  );
}

function MobileNav() {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details ref={ref} className="relative sm:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 border border-hairline-strong px-3 py-1.5 font-sans text-sm text-ink [&::-webkit-details-marker]:hidden">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
          <path d="M0 .75h14M0 5h14M0 9.25h14" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Menu
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-56 border border-hairline-strong bg-paper-raised p-1 font-sans text-sm shadow-none">
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} onClick={close} className="block px-3 py-2 text-ink-muted no-underline hover:bg-paper hover:text-ink">
            {l.label}
          </a>
        ))}
        <a
          href="#start"
          onClick={close}
          className="mt-1 block border border-accent bg-accent px-3 py-2 text-center font-semibold text-paper no-underline"
        >
          Start a case
        </a>
      </div>
    </details>
  );
}

export default function App() {
  const location = useLocation();
  const isPulse = location.pathname === '/';
  const isCalculator = location.pathname === '/calculator';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-hairline bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-x-4 px-4 py-3.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 no-underline">
            <Mark />
            <span className="min-w-0">
              <span className="block truncate font-serif text-base font-semibold leading-none text-ink">Trade Compliance Copilot</span>
              <span className="mt-1 block truncate font-mono text-[11px] uppercase leading-none tracking-wide text-ink-faint">
                {isPulse ? 'Trade Policy Pulse' : 'Compliance Calculator'}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            <Link
              to="/calculator"
              className={`font-sans text-sm no-underline hover:text-accent ${isCalculator ? 'text-accent' : 'text-ink-muted'}`}
            >
              <span className="sm:hidden">Calculator</span>
              <span className="hidden sm:inline">Compliance calculator</span>
            </Link>
            {isCalculator ? (
              <>
                <DesktopNav />
                <MobileNav />
              </>
            ) : !isPulse ? (
              <Link to="/calculator" className="font-sans text-sm text-ink-muted no-underline hover:text-accent">
                Start another case
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Pulse />} />
          <Route path="/calculator" element={<Landing />} />
          <Route path="/case/:id" element={<CaseWizard />} />
          <Route path="/case/:id/report" element={<Report />} />
        </Routes>
      </div>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 font-sans text-xs text-ink-faint">
          <span>&copy; {new Date().getFullYear()} Aex Meridian</span>
          <span className="max-w-md text-right sm:text-left">
            Not legal advice. Every determination cites its source data and its as-of date &mdash; verify against a licensed customs broker or trade attorney before relying on it.
          </span>
        </div>
      </footer>
    </div>
  );
}
