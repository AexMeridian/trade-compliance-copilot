import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Pulse } from './pages/Pulse';
import { NotFound } from './pages/NotFound';
import { PULSE_TABS } from './components/PulseTabs';
import { ThemeToggle } from './components/ThemeToggle';
import { SiteSearch } from './components/SiteSearch';
import { BetaBanner } from './components/BetaBanner';
import { LogoMark } from './components/LogoMark';
import { CitePage } from './components/CitePage';
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
const Methodology = lazyPage(() => import('./pages/Methodology'), 'Methodology');
const Terms = lazyPage(() => import('./pages/Terms'), 'Terms');
const Privacy = lazyPage(() => import('./pages/Privacy'), 'Privacy');
const Accessibility = lazyPage(() => import('./pages/Accessibility'), 'Accessibility');
const CountryCompare = lazyPage(() => import('./pages/CountryCompare'), 'CountryCompare');
const Snapshot = lazyPage(() => import('./pages/Snapshot'), 'Snapshot');


const KNOWN_PATHS = ['/', '/methodology', '/terms', '/calculator', '/abroad', '/allies', '/footprint', '/standing', '/vs-world', '/influence', '/power', '/about', '/privacy', '/accessibility', '/compare'];

// Keeps the browser tab title (and the search-engine-visible robots hint)
// accurate as a single-page app moves between views.
function usePageMeta(pathname: string, tab: string | null) {
  useEffect(() => {
    let title = `${SITE.name}: U.S. tariffs, sanctions, markets and trade news in plain English`;
    if (pathname === '/') {
      const t = PULSE_TABS.find((x) => x.id === tab);
      if (t && t.id !== 'overview') title = `${t.label} | ${SITE.name}`;
    } else if (pathname === '/calculator') title = `Compliance calculator | ${SITE.name}`;
    else if (pathname === '/abroad') title = `U.S. abroad: where U.S. policy lands | ${SITE.name}`;
    else if (pathname === '/allies') title = `Dollar & allies: trade tools, the dollar and alliances | ${SITE.name}`;
    else if (pathname === '/about') title = `About | ${SITE.name}`;
    else if (pathname === '/methodology') title = `Methodology and sources | ${SITE.name}`;
    else if (pathname === '/terms') title = `Terms of use | ${SITE.name}`;
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

// On the top bar (which follows the theme): quiet text, and the current page is a solid ink pill.
const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold no-underline ${isActive ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`;

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
            className="flex shrink-0 items-center gap-3 text-ink no-underline"
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
              Calculator <span className="ml-0.5 hidden align-middle text-[10px] font-bold uppercase tracking-wide sm:inline">Beta</span>
            </NavLink>
            <NavLink to="/abroad" className={navClass}>
              U.S. abroad
            </NavLink>
            <NavLink to="/allies" className={(s) => `${navClass(s)} hidden sm:block`}>
              Dollar &amp; allies
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
          <Route path="/compare" element={<CountryCompare />} />
          <Route path="/snapshot/:id" element={<Snapshot />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </div>

      <footer className="no-print mt-16 border-t border-hairline bg-paper-raised text-ink-muted">
        <div className="mx-auto max-w-7xl px-4 py-10 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
            <p className="max-w-xl text-[13px] leading-relaxed">
              For information only. This is not legal, customs, tax, financial or investment advice. Sources can be delayed, revised or incomplete, and market
              data is delayed and not for trading. Calculator results cite their source data and as-of dates; check them with a licensed customs broker or trade
              attorney before relying on them.
            </p>
            <nav aria-label="Site" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              <Link to="/abroad" className="text-ink no-underline hover:underline">
                U.S. abroad
              </Link>
              <Link to="/allies" className="text-ink no-underline hover:underline">
                Dollar &amp; allies
              </Link>
              <Link to="/compare" className="text-ink no-underline hover:underline">
                Compare countries
              </Link>
              <Link to="/methodology" className="text-ink no-underline hover:underline">
                Methodology and sources
              </Link>
              <Link to="/about" className="text-ink no-underline hover:underline">
                About
              </Link>
              <Link to="/terms" className="text-ink no-underline hover:underline">
                Terms
              </Link>
              <Link to="/?tab=guide" className="text-ink no-underline hover:underline">
                Guide
              </Link>
              <Link to="/privacy" className="text-ink no-underline hover:underline">
                Privacy
              </Link>
              <Link to="/accessibility" className="text-ink no-underline hover:underline">
                Accessibility
              </Link>
              <a href="/rss.xml" className="text-ink no-underline hover:underline">
                RSS feed
              </a>
              {SITE.contactEmail && (
                <a
                  href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Correction or question')}&body=${encodeURIComponent(`Page: ${window.location.href}
Date: ${new Date().toISOString().slice(0, 10)}

What I saw, and what the source says:
`)}`}
                  className="text-ink no-underline hover:underline"
                >
                  Report an error or contact us
                </a>
              )}
            </nav>
          </div>
          <CitePage />
          <p className="mt-8 text-[13px]">
            &copy; {new Date().getFullYear()} {SITE.legalName || SITE.operator}. Independent and informational; not affiliated with any government. Version {__BUILD__}.
          </p>
        </div>
      </footer>
    </div>
  );
}
