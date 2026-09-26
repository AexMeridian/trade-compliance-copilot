import { useEffect } from 'react';
import { Routes, Route, Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { CaseWizard } from './pages/CaseWizard';
import { Report } from './pages/Report';
import { Pulse } from './pages/Pulse';
import { About } from './pages/About';
import { Privacy } from './pages/Privacy';
import { NotFound } from './pages/NotFound';
import { PULSE_TABS } from './components/PulseTabs';
import { SITE } from './lib/site';

const KNOWN_PATHS = ['/', '/calculator', '/about', '/privacy'];

// Keeps the browser tab title (and the search-engine-visible robots hint)
// accurate as a single-page app moves between views.
function usePageMeta(pathname: string, tab: string | null) {
  useEffect(() => {
    let title = `${SITE.name}: U.S. tariffs, sanctions, markets and trade news in plain English`;
    if (pathname === '/') {
      const t = PULSE_TABS.find((x) => x.id === tab);
      if (t && t.id !== 'overview') title = `${t.label} | ${SITE.name}`;
    } else if (pathname === '/calculator') title = `Compliance calculator | ${SITE.name}`;
    else if (pathname === '/about') title = `About and sources | ${SITE.name}`;
    else if (pathname === '/privacy') title = `Privacy | ${SITE.name}`;
    else if (pathname.startsWith('/case/')) title = `Compliance case | ${SITE.name}`;
    else title = `Page not found | ${SITE.name}`;
    document.title = title;

    // Unknown URLs and private case pages should not be indexed.
    const indexable = KNOWN_PATHS.includes(pathname);
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

// On the black top bar: light text, and the current page is a solid yellow block.
const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold no-underline ${isActive ? 'bg-white text-ink' : 'text-[#b4b4bc] hover:text-white'}`;

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
      <header className="sticky top-0 z-10 bg-bar text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="truncate font-display text-[19px] font-extrabold tracking-tight text-white no-underline">
            {SITE.name}
          </Link>
          <nav aria-label="Main" className="flex shrink-0 items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Pulse
            </NavLink>
            <NavLink to="/calculator" className={navClass}>
              Calculator
            </NavLink>
            <NavLink to="/about" className={(s) => `${navClass(s)} hidden sm:block`}>
              About
            </NavLink>
          </nav>
        </div>
      </header>

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Pulse />} />
          <Route path="/calculator" element={<Landing />} />
          <Route path="/case/:id" element={<CaseWizard />} />
          <Route path="/case/:id/report" element={<Report />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>

      <footer className="mt-16 bg-bar text-[#b4b4bc]">
        <div className="mx-auto max-w-5xl px-4 py-10 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
            <p className="max-w-xl text-[13px] leading-relaxed">
              For information only. This is not legal, customs, tax, financial or investment advice. Sources can be delayed, revised or incomplete, and market
              data is delayed and not for trading. Calculator results cite their source data and as-of dates; check them with a licensed customs broker or trade
              attorney before relying on them.
            </p>
            <nav aria-label="Site" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
              <Link to="/about" className="text-white no-underline hover:underline">
                About and sources
              </Link>
              <Link to="/?tab=guide" className="text-white no-underline hover:underline">
                Guide
              </Link>
              <Link to="/privacy" className="text-white no-underline hover:underline">
                Privacy
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
