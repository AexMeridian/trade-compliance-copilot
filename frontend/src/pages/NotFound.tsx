import { Link, useLocation } from 'react-router-dom';
import { SITE } from '../lib/site';

const PLACES = [
  { to: '/', title: SITE.name, text: "What's changing in world trade today: new U.S. notices, markets and headlines." },
  { to: '/hard-power', title: 'Hard Power', text: 'Tariffs, sanctions, reserves and spending: where economic and military weight sits.' },
  { to: '/soft-power', title: 'Soft Power', text: 'Opinion, culture, students and aid: how countries are seen and who they reach.' },
  { to: '/calculator', title: 'Compliance calculator (Beta)', text: 'Work through a shipment: duties, sanctions and export-control checks, with sources.' },
  { to: '/?tab=guide', title: 'Guide for newcomers', text: 'How to read the front page, in plain English.' },
  { to: '/methodology', title: 'Methodology and sources', text: 'Where every number comes from and what it leaves out.' },
];

export function NotFound() {
  const { pathname } = useLocation();
  // Opens the site search (App's header listens for Ctrl/Cmd+K), so the 404 page does not need its own copy of the index.
  const openSearch = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <p className="text-[13px] font-semibold text-ink-faint">Error 404</p>
      <h1 className="display mt-1 text-4xl text-ink">We can't find that page</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
        Nothing lives at <code className="rounded bg-accent-soft px-1.5 py-0.5 text-[13px] text-ink">{pathname}</code>. The link may be old or mistyped. Search for what you wanted, or start from one of these:
      </p>
      <button type="button" onClick={openSearch} className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
        Search the site
        <span className="text-[12px] font-normal opacity-80">Ctrl+K</span>
      </button>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {PLACES.map((p) => (
          <li key={p.to}>
            <Link to={p.to} className="card block h-full p-4 no-underline hover:border-accent">
              <span className="block font-semibold text-ink">{p.title}</span>
              <span className="mt-1 block text-[13px] leading-snug text-ink-muted">{p.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
