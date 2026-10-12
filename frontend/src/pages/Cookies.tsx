import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// Describes what the code does today: no cookies are set; a few items sit in the browser's own storage.
// If a cookie, analytics tool or new storage key is ever added, update this page, the Privacy page and the date.
export function Cookies() {
  const row = 'border-t border-hairline align-top';
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Cookies and local storage</h1>
      <p className="mt-3 text-base text-ink">
        {SITE.name} does not set any cookies and has no cookie banner, because there is nothing to consent to. This page lists the small items the site keeps in your
        own browser. Last updated {SITE.cookiesUpdated}.
      </p>

      <H>Cookies</H>
      <p className="mt-3">
        None. The site, its data endpoints and its feeds never send a Set-Cookie header, and we load no analytics, advertising, social-media or other third-party
        scripts that could set their own. Our hosting provider, Cloudflare, may set cookies of its own only on a security challenge page if it decides to
        challenge a visit; we do not control those, and none are set in normal use.
      </p>

      <H>What is kept in your browser</H>
      <p className="mt-3">
        The site uses your browser's local storage (and, once, session storage) to make features you asked for work. These items stay on your device and are never
        sent to us or used to follow you around the web. They are strictly necessary for the feature, so the law does not require consent for them.
      </p>
      <div className="mt-4">
        <table className="w-full table-fixed text-left">
          <caption className="sr-only">Items stored in your browser</caption>
          <thead className="text-ink">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">What</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Why</th>
              <th scope="col" className="py-2 font-semibold">How long</th>
            </tr>
          </thead>
          <tbody>
            <tr className={row}>
              <td className="py-2 pr-3 text-ink">Your filters</td>
              <td className="py-2 pr-3">The topics, countries and markets you chose under "Filter".</td>
              <td className="py-2">Until you reset them or clear site data</td>
            </tr>
            <tr className={row}>
              <td className="py-2 pr-3 text-ink">Theme</td>
              <td className="py-2 pr-3">Your light or dark choice.</td>
              <td className="py-2">Until you change it or clear site data</td>
            </tr>
            <tr className={row}>
              <td className="py-2 pr-3 text-ink">Starter card dismissed</td>
              <td className="py-2 pr-3">So the starter card does not come back after you close it.</td>
              <td className="py-2">Until you clear site data</td>
            </tr>
            <tr className={row}>
              <td className="py-2 pr-3 text-ink">Case delete secret</td>
              <td className="py-2 pr-3">Lets the browser that created a calculator case delete it. We keep only a one-way hash.</td>
              <td className="py-2">Until you clear site data (the case itself expires after 30 days)</td>
            </tr>
            <tr className={row}>
              <td className="py-2 pr-3 text-ink">Reload flag (session)</td>
              <td className="py-2 pr-3">After a new release, lets the page reload itself once instead of showing an error.</td>
              <td className="py-2">Until you close the tab</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H>Your choices</H>
      <p className="mt-3">
        You can remove all of this at any time by clearing site data in your browser's settings, or use "Reset to default" on the filter panel. The site keeps
        working without it; you will just see the defaults. Because we do not track you, there is no tracking to opt out of; we also honour Global Privacy Control
        and Do Not Track signals as opt-outs by default.
      </p>

      <H>If this changes</H>
      <p className="mt-3">
        If we ever add a cookie or an analytics tool, we will update this page and the{' '}
        <Link to="/privacy" className="text-accent">
          Privacy policy
        </Link>{' '}
        first, and ask for consent where the law requires it.
        {SITE.contactEmail && (
          <>
            {' '}
            Questions:{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}

export default Cookies;
