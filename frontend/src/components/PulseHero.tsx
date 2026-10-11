import { lazy, Suspense } from 'react';
import { HeroBackdrop } from './HeroBackdrop';
import type { NewsItem, PulseAction, PulseMarkets, PulseSummary } from '../types/pulse';
import { PulseCountryCard } from './PulseCountryCard';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { PulseDelta } from './PulseDelta';
import { timeAgo } from './PulseNews';
import { friendlyDate, plainSummary } from '../lib/pulsePlain';
// Loaded on its own so the map library and outlines don't slow the first paint.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

const GlobePlaceholder = () => <div className="mx-auto aspect-square w-full max-w-[760px] rounded-full border border-hero-border" aria-hidden="true" />;

// The globe is the hero: centered and large, with the headline set directly
// over it rather than beside it. The radial wash behind the headline (.hero-mask,
// index.css) is functional, not decorative -- the globe keeps turning and
// recoloring under the cursor, so without it the text's contrast would depend
// on whatever happens to be rotated underneath at that moment. It's
// pointer-events-none, so drag/hover/click all still reach the canvas
// straight through it, and it fades to --color-hero-bg rather than a fixed
// black so it still works once the hero itself can be light (light theme).
export function PulseHero({
  summary,
  markets,
  activeMeasures,
  activeCountry,
  onCountry,
  onClearCountry,
  onSeeAll,
  recent,
  news,
  lead,
  onExplore,
  updatedText,
  syncing,
  onRefresh,
}: {
  summary: PulseSummary | null;
  markets: PulseMarkets | null;
  activeMeasures: number | null;
  activeCountry: string | null;
  onCountry: (code: string) => void;
  onClearCountry: () => void;
  onSeeAll: () => void;
  recent: PulseAction[];
  news: NewsItem[];
  lead: PulseAction | null; // the top story, shown large beside the globe
  onExplore: () => void;
  updatedText: string;
  syncing: boolean;
  onRefresh: () => void;
}) {
  const breakdown = summary?.countryBreakdown ?? [];
  const top = breakdown.slice(0, 6);
  const others = Object.keys(COUNTRY_LABELS)
    .filter((c) => !top.some((t) => t.country === c))
    .sort((a, b) => COUNTRY_LABELS[a].localeCompare(COUNTRY_LABELS[b]));

  return (
    <section className="stage relative isolate overflow-x-clip bg-hero-bg text-hero-ink">
      <HeroBackdrop />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-12">
       <div className="min-w-0 text-center">
        <div className="relative mx-auto w-full max-w-[760px] lg:max-w-[600px]">
          <div className="px-2 pb-5">
            <h1 className="display text-3xl leading-tight sm:text-4xl lg:text-5xl">New U.S. trade notices, mapped</h1>
            <p className="mx-auto mt-3 max-w-xs text-[13px] leading-snug text-hero-ink-muted sm:max-w-sm sm:text-base">
              Every country named in new U.S. government notices on tariffs, sanctions or export limits.
            </p>
          </div>
          {summary ? (
            <Suspense fallback={<GlobePlaceholder />}>
              <PulseGlobe breakdown={breakdown} activeCountry={activeCountry} onSelect={onCountry} />
            </Suspense>
          ) : (
            <GlobePlaceholder />
          )}
        </div>

        {summary && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onCountry('US')}
                aria-pressed={activeCountry === 'US'}
                className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${
                  activeCountry === 'US'
                    ? 'border-hero-btn-bg bg-hero-btn-bg text-hero-btn-text'
                    : 'border-hero-border text-hero-ink hover:border-hero-border-strong hover:bg-hero-card-bg'
                }`}
              >
                United States
              </button>
              {top.map((b) => (
                <button
                  key={b.country}
                  type="button"
                  onClick={() => onCountry(b.country)}
                  aria-pressed={activeCountry === b.country}
                  className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${
                    activeCountry === b.country
                      ? 'border-hero-btn-bg bg-hero-btn-bg text-hero-btn-text'
                      : 'border-hero-border text-hero-ink hover:border-hero-border-strong hover:bg-hero-card-bg'
                  }`}
                >
                  {COUNTRY_LABELS[b.country] ?? b.country} <span className="tabular-nums opacity-70">{b.count}</span>
                </button>
              ))}
              <select
                aria-label="Choose another country"
                value=""
                onChange={(e) => e.target.value && onCountry(e.target.value)}
                className="border border-hero-border bg-hero-bg px-2 py-1 text-[13px] font-semibold text-hero-ink"
              >
                <option value="">More countries…</option>
                {others.map((c) => (
                  <option key={c} value={c}>
                    {COUNTRY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            {activeCountry && (
              <div className="mt-4 text-left">
                <PulseCountryCard
                  code={activeCountry}
                  count={breakdown.find((b) => b.country === activeCountry)?.count ?? 0}
                  rank={(() => {
                    const i = breakdown.findIndex((b) => b.country === activeCountry);
                    return i >= 0 ? i + 1 : null;
                  })()}
                  summary={summary}
                  markets={markets}
                  actions={recent}
                  news={news}
                  onSeeAll={onSeeAll}
                  onClose={onClearCountry}
                />
              </div>
            )}

          </>
        )}
       </div>

       {summary && <StageRail summary={summary} activeMeasures={activeMeasures} lead={lead} recent={recent} news={news} onExplore={onExplore} onRefresh={onRefresh} syncing={syncing} updatedText={updatedText} onSeeAll={onSeeAll} />}
      </div>
    </section>
  );
}

type LatestItem = { key: string; when: string; label: string; title: string; href: string; time: string };

// The right-hand column of the front-page stage: the lead story set large, a short "Latest" list that mixes
// new government notices and headlines by date, and the figures that summarise the window. Everything is
// taken from data the page already holds; the lead is the same ranked top action the highlights use.
function StageRail({
  summary,
  activeMeasures,
  lead,
  recent,
  news,
  onExplore,
  onRefresh,
  syncing,
  updatedText,
  onSeeAll,
}: {
  summary: PulseSummary;
  activeMeasures: number | null;
  lead: PulseAction | null;
  recent: PulseAction[];
  news: NewsItem[];
  onExplore: () => void;
  onRefresh: () => void;
  syncing: boolean;
  updatedText: string;
  onSeeAll: () => void;
}) {
  const items: LatestItem[] = [
    ...recent
      .filter((a) => a.document_number !== lead?.document_number)
      .slice(0, 12)
      .map((a) => ({ key: a.document_number, when: a.publication_date, label: a.agency, title: a.title, href: a.html_url, time: friendlyDate(a.publication_date) })),
    ...news.slice(0, 12).map((n) => ({ key: n.id, when: n.published_at, label: n.source, title: n.title, href: n.url, time: timeAgo(n.published_at) })),
  ]
    .sort((x, y) => y.when.localeCompare(x.when))
    .slice(0, 5);

  return (
    <aside aria-label="Top story and latest" className="min-w-0 text-left">
      {lead && (
        <div className="border-t-2 border-hero-ink pt-3">
          <p className="text-[13px] font-semibold text-hero-ink-faint">Top U.S. trade action</p>
          <a href={lead.html_url} target="_blank" rel="noreferrer" className="mt-2 block font-serif text-[26px] font-semibold leading-[1.15] text-hero-ink no-underline hover:underline">
            {lead.title}
          </a>
          <p className="mt-2 text-[14px] leading-relaxed text-hero-ink-muted">{plainSummary(lead)}</p>
          <p className="mt-2 text-[12px] text-hero-ink-faint">
            {lead.agency}, {friendlyDate(lead.publication_date)}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 border-t border-hero-divider pt-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-sans text-[13px] font-semibold tracking-normal text-hero-ink">Latest</h2>
            <button type="button" onClick={onSeeAll} className="text-[12px] text-hero-ink-faint underline hover:text-hero-ink">
              All U.S. policy
            </button>
          </div>
          <ul className="mt-1 divide-y divide-hero-divider">
            {items.map((it) => (
              <li key={it.key} className="py-2.5">
                <a href={it.href} target="_blank" rel="noreferrer" className="block font-serif text-[16px] leading-snug text-hero-ink no-underline hover:underline">
                  {it.title}
                </a>
                <p className="mt-0.5 text-[12px] tabular-nums text-hero-ink-faint">
                  {it.label} · {it.time}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-[14px] leading-snug text-hero-ink-muted">
        <span className="font-semibold text-hero-ink">{activeMeasures ?? '…'}</span> measures in force, <span className="font-semibold text-hero-ink">{summary.last30}</span> new official
        notices in the last 30 days
        {summary.trendPct !== null && (
          <>
            {' '}
            (<PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct)}%`} className="font-semibold" />)
          </>
        )}
        {summary.leadingTag ? `, mostly ${summary.leadingTag.toLowerCase()}` : ''}.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onExplore} className="btn-hero">
          Explore U.S. policy
        </button>
        <button type="button" onClick={onRefresh} disabled={syncing} className="btn-hero-ghost">
          {syncing ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
      <p className="mt-3 text-[12px] text-hero-ink-faint">{updatedText}</p>
    </aside>
  );
}
