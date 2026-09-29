import { lazy, Suspense } from 'react';
import type { NewsItem, PulseAction, PulseSummary } from '../types/pulse';
import { PulseCountryCard } from './PulseCountryCard';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { PulseDelta } from './PulseDelta';
// Loaded on its own so the map library and outlines don't slow the first paint.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

const GlobePlaceholder = () => <div className="mx-auto aspect-square w-full max-w-[440px] rounded-full border border-white/20" aria-hidden="true" />;

// The globe is the hero: centered and large, with the headline set directly
// over it rather than beside it. The dark radial wash behind the headline is
// functional, not decorative -- the globe keeps turning and recoloring under
// the cursor, so without it the text's contrast would depend on whatever
// happens to be rotated underneath at that moment. It's pointer-events-none,
// so drag/hover/click all still reach the canvas straight through it.
export function PulseHero({
  summary,
  activeMeasures,
  activeCountry,
  onCountry,
  onClearCountry,
  onSeeAll,
  recent,
  news,
  onExplore,
  updatedText,
  syncing,
  onRefresh,
}: {
  summary: PulseSummary | null;
  activeMeasures: number | null;
  activeCountry: string | null;
  onCountry: (code: string) => void;
  onClearCountry: () => void;
  onSeeAll: () => void;
  recent: PulseAction[];
  news: NewsItem[];
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
    <section className="bg-bar text-white">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 text-center sm:pt-12">
        <div className="relative mx-auto w-full max-w-[520px]">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pb-16 pt-2"
            style={{ background: 'radial-gradient(ellipse 70% 85% at 50% 15%, rgba(10,10,11,0.94) 0%, rgba(10,10,11,0.7) 45%, rgba(10,10,11,0) 78%)' }}
          >
            <h1 className="display text-2xl leading-tight text-white sm:text-3xl">New U.S. trade actions, mapped</h1>
            <p className="mx-auto mt-2 max-w-xs text-[13px] leading-snug text-[#d8d8dd] sm:text-sm">
              Every country the U.S. is hitting with tariffs, sanctions or export limits right now.
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
                  activeCountry === 'US' ? 'border-white bg-white text-ink' : 'border-white/30 text-white hover:border-white hover:bg-white/10'
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
                    activeCountry === b.country ? 'border-white bg-white text-ink' : 'border-white/30 text-white hover:border-white hover:bg-white/10'
                  }`}
                >
                  {COUNTRY_LABELS[b.country] ?? b.country} <span className="tabular-nums opacity-70">{b.count}</span>
                </button>
              ))}
              <select
                aria-label="Choose another country"
                value=""
                onChange={(e) => e.target.value && onCountry(e.target.value)}
                className="border border-white/30 bg-bar px-2 py-1 text-[13px] font-semibold text-white"
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
                  actions={recent}
                  news={news}
                  onSeeAll={onSeeAll}
                  onClose={onClearCountry}
                />
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={onExplore} className="btn-hero">
                Explore U.S. policy
              </button>
              <button type="button" onClick={onRefresh} disabled={syncing} className="btn-hero-ghost">
                {syncing ? 'Checking…' : 'Check for updates'}
              </button>
            </div>
            <p className="mt-4 text-base leading-snug text-white">
              <span className="font-semibold">{activeMeasures ?? '…'}</span> measures in force,{' '}
              <span className="font-semibold">{summary.last30}</span> new actions in the last 30 days
              {summary.trendPct !== null && (
                <>
                  {' '}
                  (<PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct)}%`} onDark className="font-semibold" />)
                </>
              )}
              {summary.leadingTag ? `, mostly ${summary.leadingTag.toLowerCase()}` : ''}.
            </p>
            <p className="mt-2 text-[13px] text-[#b4b4bc]">{updatedText}</p>
          </>
        )}
      </div>
    </section>
  );
}
