import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Routes, Route, Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Pulse } from './pages/Pulse';
import { NotFound } from './pages/NotFound';
import { PULSE_TABS } from './components/PulseTabs';
import { ThemeToggle } from './components/ThemeToggle';
import { SiteSearch } from './components/SiteSearch';
import { SITE } from './lib/site';
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
const Privacy = lazyPage(() => import('./pages/Privacy'), 'Privacy');
const Accessibility = lazyPage(() => import('./pages/Accessibility'), 'Accessibility');
const CountryCompare = lazyPage(() => import('./pages/CountryCompare'), 'CountryCompare');
const Snapshot = lazyPage(() => import('./pages/Snapshot'), 'Snapshot');


const KNOWN_PATHS = ['/', '/calculator', '/influence', '/power', '/about', '/privacy', '/accessibility', '/compare'];

// Keeps the browser tab title (and the search-engine-visible robots hint)
// accurate as a single-page app moves between views.
function usePageMeta(pathname: string, tab: string | null) {
  useEffect(() => {
    let title = `${SITE.name}: U.S. tariffs, sanctions, markets and trade news in plain English`;
    if (pathname === '/') {
      const t = PULSE_TABS.find((x) => x.id === tab);
      if (t && t.id !== 'overview') title = `${t.label} | ${SITE.name}`;
    } else if (pathname === '/calculator') title = `Compliance calculator | ${SITE.name}`;
    else if (pathname === '/influence') title = `American influence: pressure and reach | ${SITE.name}`;
    else if (pathname === '/power') title = `American power: hard and soft | ${SITE.name}`;
    else if (pathname === '/about') title = `About and sources | ${SITE.name}`;
    else if (pathname === '/privacy') title = `Privacy | ${SITE.name}`;
    else if (pathname === '/accessibility') title = `Accessibility | ${SITE.name}`;
    else if (pathname === '/compare') title = `Compare countries | ${SITE.name}`;
    else if (pathname.startsWith('/case/')) title = `Compliance case | ${SITE.name}`;
    else if (pathname.startsWith('/snapshot/')) title = `Cited snapshot | ${SITE.name}`;
    else if (pathname.startsWith('/country/')) {
      const code = pathname.slice('/country/'.length).toUpperCase();
      const name = TARIFF_COUNTRY_LABELS[code] ?? code;
      title = `${name} | ${SITE.name}`;
    } else title = `Page not found | ${SITE.name}`;
    document.title = title;

    // Unknown URLs and private case pages should not be indexed. Country
    // pages are real content (like /about), so they're indexable too, but
    // their path varies per code, so it needs a prefix check rather than an
    // exact match against the fixed KNOWN_PATHS list.
    const indexable = KNOWN_PATHS.includes(pathname) || pathname.startsWith('/country/');
    let robots = document.querySelector('meta[name="robots"]');
    if (!indexable) {
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

// On the black top bar: light text, and the current page is a solid white
// block. text-[#0b0b0c] (not the text-ink token) is deliberate -- this pill's
// background is always literal white regardless of site theme (the bar never
// changes, see index.css's dark-theme comment), but text-ink itself DOES flip
// with theme, which would make the active tab's label nearly invisible in
// dark theme (near-white text on a white pill).
const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold no-underline ${isActive ? 'bg-white text-[#0b0b0c]' : 'text-[#b4b4bc] hover:text-white'}`;

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
      <header className="no-print sticky top-0 z-10 border-b border-white/15 bg-bar text-white">
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
            className="flex shrink-0 items-center font-display text-[19px] font-extrabold tracking-tight text-white no-underline"
            aria-label={SITE.name}
          >
            <img src="/favicon.svg" alt="" aria-hidden="true" className="h-7 w-7 rounded sm:hidden" />
            <span className="hidden sm:inline">{SITE.name}</span>
          </Link>
          <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <NavLink to="/" end className={navClass}>
              Pulse
            </NavLink>
            <NavLink to="/calculator" className={navClass}>
              Calculator
            </NavLink>
            <NavLink to="/influence" className={navClass}>
              Influence
            </NavLink>
            <NavLink to="/power" className={(s) => `${navClass(s)} hidden sm:block`}>
              Power
            </NavLink>
            <NavLink to="/about" className={(s) => `${navClass(s)} hidden sm:block`}>
              About
            </NavLink>
            <SiteSearch />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div id="main" className="flex-1">
        <Suspense fallback={<p className="mx-auto max-w-4xl px-4 py-16 text-sm text-ink-faint">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Pulse />} />
          <Route path="/calculator" element={<Landing />} />
          <Route path="/influence" element={<Influence />} />
          <Route path="/power" element={<Power />} />
          <Route path="/country/:code" element={<CountryDetail />} />
          <Route path="/case/:id" element={<CaseWizard />} />
          <Route path="/case/:id/report" element={<Report />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/compare" element={<CountryCompare />} />
          <Route path="/snapshot/:id" element={<Snapshot />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>

      <footer className="no-print mt-16 bg-bar text-[#b4b4bc]">
        <div className="mx-auto max-w-7xl px-4 py-10 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
            <p className="max-w-xl text-[13px] leading-relaxed">
              For information only. This is not legal, customs, tax, financial or investment advice. Sources can be delayed, revised or incomplete, and market
              data is delayed and not for trading. Calculator results cite their source data and as-of dates; check them with a licensed customs broker or trade
              attorney before relying on them.
            </p>
            <nav aria-label="Site" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              <Link to="/influence" className="text-white no-underline hover:underline">
                American influence
              </Link>
              <Link to="/power" className="text-white no-underline hover:underline">
                American power
              </Link>
              <Link to="/compare" className="text-white no-underline hover:underline">
                Compare countries
              </Link>
              <Link to="/about" className="text-white no-underline hover:underline">
                About and sources
              </Link>
              <Link to="/?tab=guide" className="text-white no-underline hover:underline">
                Guide
              </Link>
              <Link to="/privacy" className="text-white no-underline hover:underline">
                Privacy
              </Link>
              <Link to="/accessibility" className="text-white no-underline hover:underline">
                Accessibility
              </Link>
              <a href="/api/pulse/rss" className="text-white no-underline hover:underline">
                RSS feed
              </a>
              {SITE.contactEmail && (
                <a href={`mailto:${SITE.contactEmail}`} className="text-white no-underline hover:underline">
                  Contact
                </a>
              )}
            </nav>
          </div>
          <p className="mt-8 text-[13px]">
            &copy; {new Date().getFullYear()} {SITE.operator}
          </p>
        </div>
      </footer>
    </div>
  );
}
