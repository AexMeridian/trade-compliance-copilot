import { lazy, Suspense } from 'react';
import type { NewsItem, PulseAction, PulseSummary } from '../types/pulse';
import { PulseCountryCard } from './PulseCountryCard';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { PulseDelta } from './PulseDelta';
// Loaded on its own so the map library and outlines don't slow the first paint.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

const GlobePlaceholder = () => <div className="mx-auto aspect-square w-full max-w-[440px] rounded-full border border-white/20" aria-hidden="true" />;

// The top of the page: the one number most visitors want (how much the U.S. has
// done on trade lately), what changed, and a globe of where. The globe is
// pointer-driven, so the same choice is also offered as buttons and a list.
export function PulseHero({
  summary,
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
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pb-24 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-12">
        <div>
          <h1 className="text-lg font-semibold leading-snug text-white">
            New U.S. trade actions
            <span className="block text-[15px] font-normal text-[#b4b4bc]">in the last 30 days, in plain English</span>
          </h1>
          <p className="display mt-3 text-[120px] text-white sm:text-[176px]" aria-label={summary ? `${summary.last30} actions` : 'Loading'}>
            {summary ? summary.last30 : '...'}
          </p>
          {summary && (
            <p className="mt-4 max-w-md text-lg leading-snug text-white">
              {summary.trendPct !== null ? (
                <>
                  <PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct)}%`} onDark className="font-semibold" /> from the 30 days before
                </>
              ) : (
                'No earlier period to compare yet'
              )}
              {summary.leadingTag ? `, mostly ${summary.leadingTag.toLowerCase()}` : ''}.
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onExplore} className="btn-hero">
              Explore U.S. policy
            </button>
            <button type="button" onClick={onRefresh} disabled={syncing} className="btn-hero-ghost">
              {syncing ? 'Checking…' : 'Check for updates'}
            </button>
          </div>
          <p className="mt-3 text-[13px] text-[#b4b4bc]">{updatedText}</p>
        </div>

        <div className="min-w-0">
          {summary ? (
            <>
              <Suspense fallback={<GlobePlaceholder />}>
                <PulseGlobe breakdown={breakdown} activeCountry={activeCountry} onSelect={onCountry} />
              </Suspense>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
                <PulseCountryCard
                  code={activeCountry}
                  count={breakdown.find((b) => b.country === activeCountry)?.count ?? 0}
                  rank={(() => {
                    const i = breakdown.findIndex((b) => b.country === activeCountry);
                    return i >= 0 ? i + 1 : null;
                  })()}
                  actions={recent}
                  news={news}
                  onSeeAll={onSeeAll}
                  onClose={onClearCountry}
                />
              )}
            </>
          ) : (
            <GlobePlaceholder />
          )}
        </div>
      </div>
    </section>
  );
}
