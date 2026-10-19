import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react';
import { MobileMenu } from './components/MobileMenu';
import { Routes, Route, Link, NavLink, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Pulse } from './pages/Pulse';
import { NotFound } from './pages/NotFound';
import { PULSE_TABS } from './components/PulseTabs';
import { ThemeToggle } from './components/ThemeToggle';
import { SiteSearch } from './components/SiteSearch';
import { BetaBanner } from './components/BetaBanner';
import { MarketStrip } from './components/MarketStrip';
import { LogoMark } from './components/LogoMark';
import { SiteFooter } from './components/SiteFooter';
import { SITE } from './lib/site';
import { pageMeta } from './lib/pageMeta';
import { TARIFF_COUNTRY_LABELS } from './lib/pulseTariffCountries';

// Everything except the home page loads on demand, so a first visit downloads only
// what it shows (the home page is the entry point for most visitors).
const lazyPage = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));
const Landing = lazyPage(() => import('./pages/Landing'), 'Landing');
const CaseWizard = lazyPage(() => import('./pages/CaseWizard'), 'CaseWizard');
const Report = lazyPage(() => import('./pages/Report'), 'Report');
const Influence = lazyPage(() => import('./pages/Influence'), 'Influence');
const Power = lazyPage(() => import('./pages/Power'), 'Power');
const CountryDetail = lazyPage(() => import('./pages/CountryDetail'), 'CountryDetail');
const About = lazyPage(() => import('./pages/About'), 'About');
const Methodology = lazyPage(() => import('./pages/Methodology'), 'Methodology');
const Terms = lazyPage(() => import('./pages/Terms'), 'Terms');
const Privacy = lazyPage(() => import('./pages/Privacy'), 'Privacy');
const Accessibility = lazyPage(() => import('./pages/Accessibility'), 'Accessibility');
const Cookies = lazyPage(() => import('./pages/Cookies'), 'Cookies');
const Disclaimer = lazyPage(() => import('./pages/Disclaimer'), 'Disclaimer');
const Copyright = lazyPage(() => import('./pages/Copyright'), 'Copyright');
const Security = lazyPage(() => import('./pages/Security'), 'Security');
const CountryCompare = lazyPage(() => import('./pages/CountryCompare'), 'CountryCompare');
const Snapshot = lazyPage(() => import('./pages/Snapshot'), 'Snapshot');



// Keeps the browser tab title, description, canonical address and robots hint accurate as a single-page app moves between views.
// The same function (lib/pageMeta.ts) writes these tags into the HTML the Worker serves, so crawlers and link previews that do not
// run scripts see them too.
function usePageMeta(pathname: string, tab: string | null) {
  useEffect(() => {
    const code = /^\/country\/([A-Za-z]{2})$/.exec(pathname)?.[1]?.toUpperCase();
    const meta = pageMeta(pathname, tab, PULSE_TABS.find((x) => x.id === tab)?.label ?? null, code ? (TARIFF_COUNTRY_LABELS[code] ?? null) : null);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', meta.canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', meta.canonical);

    let robots = document.querySelector('meta[name="robots"]');
    if (!meta.indexable) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex');
    } else if (robots) {
      robots.remove();
    }
  }, [pathname, tab]);
}

// On the top bar (which follows the theme): quiet text, and the current page is a solid ink pill.
const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 pointer-coarse:py-3 text-sm font-semibold no-underline ${isActive ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`;

export default function App() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  usePageMeta(location.pathname, searchParams.get('tab'));

  // A new page (footer link, header link) should open at its top, not wherever
  // the previous page was scrolled. Only the path counts: changing a tab or
  // filter in the address bar keeps the reader's place, and #anchors are left
  // to the browser.
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a page change (not on first load, and not for a tab or filter change) focus moves to the page itself, so a keyboard
  // user continues from the new content instead of from the link they clicked, and a screen reader announces the new page.
  const firstPath = useRef(location.pathname);
  useEffect(() => {
    if (firstPath.current === location.pathname) return;
    firstPath.current = location.pathname;
    if (!location.hash) document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen flex-col">
      {/* Visually hidden until focused -- the first tab stop on every page, so a
          keyboard or screen-reader user isn't forced through the header nav
          (and, on pages with a tab bar, isn't forced through that too) before
          reaching the content. */}
      <a href="#main" className="skip-link no-print">
        Skip to content
      </a>
      {/* border-b so the sticky nav reads as its own bar rather than bleeding
          into the hero below -- both use bg-bar, so without a seam they were
          one indistinguishable black area. no-print: a printed case report
          (Report.tsx) has its own print-only header, not this site chrome. */}
      <header className="no-print sticky top-0 z-10 border-b border-hairline bg-paper-raised text-ink">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          {/* Below sm, the full wordmark doesn't fit next to all four nav
              links without truncating mid-word -- the mark alone (it's
              already drawn on the header's own background color) reads fine
              at that size and never clips. */}
          {/* The scroll-reset effect below only fires on a pathname change, so
              it misses this link when you're already on "/" with a tab in
              the query string (e.g. "/?tab=guide") -- the logo should always
              return to the hero, so it scrolls explicitly on click too. */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0 })}
            className="flex shrink-0 items-center gap-3 text-ink no-underline pointer-coarse:-m-1.5 pointer-coarse:p-1.5"
            aria-label={SITE.name}
          >
            <LogoMark className="h-8 w-8 shrink-0 text-mark" />
            <span className="hidden font-[family-name:var(--font-wordmark)] text-[19px] font-semibold uppercase tracking-[0.3em] sm:inline">{SITE.name}</span>
          </Link>
          <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <NavLink to="/" end className={navClass}>
              Pulse
            </NavLink>
            <NavLink to="/calculator" className={navClass}>
              Calculator <span className="ml-0.5 hidden align-middle text-[10px] font-bold uppercase tracking-wide lg:inline">Beta</span>
            </NavLink>
            <NavLink to="/abroad" className={(s) => `${navClass(s)} hidden lg:block`}>
              U.S. abroad
            </NavLink>
            <NavLink to="/allies" className={(s) => `${navClass(s)} hidden lg:block`}>
              Dollar &amp; allies
            </NavLink>
            <NavLink to="/about" className={(s) => `${navClass(s)} hidden lg:block`}>
              About
            </NavLink>
            <SiteSearch />
            <ThemeToggle />
            <MobileMenu />
          </nav>
        </div>
      </header>

      <MarketStrip />

      {/* A minimum height keeps the footer below the fold while a page loads, so it does not jump when the page arrives. */}
      <main id="main" tabIndex={-1} className="min-h-[85vh] flex-1 outline-none">
        {(location.pathname === '/calculator' || location.pathname.startsWith('/case/')) && <BetaBanner />}
        <Suspense fallback={<p className="mx-auto max-w-4xl px-4 py-16 text-sm text-ink-faint">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Pulse />} />
          <Route path="/calculator" element={<Landing />} />
          <Route path="/abroad" element={<Influence />} />
          <Route path="/allies" element={<Power />} />
          <Route path="/footprint" element={<Navigate to={{ pathname: '/abroad', search: location.search }} replace />} />
          <Route path="/standing" element={<Navigate to={{ pathname: '/allies', search: location.search }} replace />} />
          <Route path="/vs-world" element={<Navigate to={{ pathname: '/allies', search: location.search }} replace />} />
          {/* Old addresses keep working: bookmarks, shared links and search results. */}
          <Route path="/influence" element={<Navigate to={{ pathname: '/abroad', search: location.search }} replace />} />
          <Route path="/power" element={<Navigate to={{ pathname: '/allies', search: location.search }} replace />} />
          <Route path="/country/:code" element={<CountryDetail />} />
          <Route path="/case/:id" element={<CaseWizard />} />
          <Route path="/case/:id/report" element={<Report />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="/copyright" element={<Copyright />} />
          <Route path="/security" element={<Security />} />
          <Route path="/compare" element={<CountryCompare />} />
          <Route path="/snapshot/:id" element={<Snapshot />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
