import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';
import { LogoMark } from './LogoMark';
import { CitePage } from './CitePage';

const col = 'flex flex-col gap-2.5';
const head = 'mb-1 font-sans text-[13px] font-semibold tracking-normal text-ink';
const link = 'text-[14px] text-ink-muted no-underline hover:text-ink hover:underline';

// A newsroom-style sitemap footer: who we are on the left, then the site's sections, the data and methods,
// and the legal pages, each in its own column. The disclaimer sits at the foot, where readers expect it.
export function SiteFooter() {
  const report = SITE.contactEmail
    ? `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Correction or question')}&body=${encodeURIComponent(`Page: ${window.location.href}\nDate: ${new Date().toISOString().slice(0, 10)}\n\nWhat I saw, and what the source says:\n`)}`
    : null;
  return (
    <footer className="no-print mt-16 border-t border-hairline bg-paper-raised text-ink-muted">
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-3 text-mark">
              <LogoMark className="h-9 w-9 shrink-0" />
              <span className="font-[family-name:var(--font-wordmark)] text-[18px] font-semibold uppercase tracking-[0.3em] text-ink">{SITE.name}</span>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed">
              Tracking what governments publish about trade: U.S. tariffs, sanctions and export controls, how they reach other countries, and the markets and news around
              them, with a source on every item.
            </p>
            <p className="mt-3 text-[13px] text-ink-faint">Independent and non-partisan. Not affiliated with any government.</p>
          </div>

          <nav aria-label="Sections" className={col}>
            <h2 className={head}>Sections</h2>
            <Link to="/" className={link}>Pulse</Link>
            <Link to="/?tab=policy" className={link}>U.S. policy</Link>
            <Link to="/?tab=markets" className={link}>Markets</Link>
            <Link to="/?tab=news" className={link}>News</Link>
            <Link to="/abroad" className={link}>U.S. abroad</Link>
            <Link to="/allies" className={link}>Dollar &amp; allies</Link>
            <Link to="/compare" className={link}>Compare countries</Link>
            <Link to="/calculator" className={link}>Compliance calculator (Beta)</Link>
          </nav>

          <nav aria-label="Data and methods" className={col}>
            <h2 className={head}>Data and methods</h2>
            <Link to="/methodology" className={link}>Methodology and sources</Link>
            <Link to="/methodology#sources" className={link}>Data sources and licences</Link>
            <Link to="/?tab=guide" className={link}>Guide</Link>
            <a href="/rss.xml" className={link}>RSS feed</a>
            <a href="/atom.xml" className={link}>Atom feed</a>
            <a href="/feed.json" className={link}>JSON feed</a>
          </nav>

          <nav aria-label="About and legal" className={col}>
            <h2 className={head}>About</h2>
            <Link to="/about" className={link}>About {SITE.name}</Link>
            <Link to="/terms" className={link}>Terms of use</Link>
            <Link to="/privacy" className={link}>Privacy</Link>
            <Link to="/accessibility" className={link}>Accessibility</Link>
            <a href="/.well-known/security.txt" className={link}>Security</a>
            {report && <a href={report} className={link}>Report an error or contact us</a>}
          </nav>
        </div>

        <p className="mt-10 max-w-4xl border-t border-hairline pt-6 text-[13px] leading-relaxed text-ink-faint">
          For information only. Nothing on this site is legal, customs, tax, financial or investment advice. Sources can be delayed, revised or incomplete, and market data is
          delayed and not for trading. Calculator results cite their source data and as-of dates; check them with a licensed customs broker or trade attorney before relying
          on them.
        </p>
        <CitePage />
        <p className="mt-6 text-[13px] text-ink-faint">
          &copy; {new Date().getFullYear()} {SITE.legalName || SITE.operator}. All rights reserved. Version {__BUILD__}.
        </p>
      </div>
    </footer>
  );
}
