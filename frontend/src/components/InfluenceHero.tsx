import { lazy, Suspense } from 'react';
import type { NewsItem, PulseAction, PulseSummary } from '../types/pulse';
import { PulseCountryCard } from './PulseCountryCard';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { BLOC_LABELS, blocsFor } from '../lib/pulseBlocs';
import { BLOC_GLOBE_LEGEND, blocGroupColorFor } from '../lib/pulseBlocGlobe';
import { PulseDelta } from './PulseDelta';
// Loaded on its own so the map library and outlines don't slow the first paint.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

const GlobePlaceholder = () => <div className="mx-auto aspect-square w-full max-w-[760px] rounded-full border border-hero-border" aria-hidden="true" />;

// Same centered-globe-with-overlay hero treatment as PulseHero, recolored by
// alliance membership instead of by how many actions named a country -- see
// lib/pulseBlocs.ts for what "membership" means here and its limits.
export function InfluenceHero({
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
  const countryCount = breakdown.length;
  const top = breakdown.slice(0, 6);
  const others = Object.keys(COUNTRY_LABELS)
    .filter((c) => !top.some((t) => t.country === c))
    .sort((a, b) => COUNTRY_LABELS[a].localeCompare(COUNTRY_LABELS[b]));
  const counts = new Map(breakdown.map((b) => [b.country, b.count]));

  const describe = (code: string) => {
    if (code === 'US') return 'United States: the country whose influence abroad this page follows.';
    const blocs = blocsFor(code);
    const blocText = blocs.length ? `Belongs to ${blocs.map((b) => BLOC_LABELS[b]).join(', ')}.` : 'Not a member of a bloc tracked here.';
    const n = counts.get(code) ?? 0;
    return `${COUNTRY_LABELS[code] ?? code}: ${blocText} ${n === 0 ? 'No U.S. economic actions' : `${n} U.S. economic ${n === 1 ? 'action' : 'actions'}`} in the last 30 days.`;
  };

  return (
    <section className="bg-hero-bg text-hero-ink">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-8 text-center sm:pt-12">
        <div className="relative mx-auto w-full max-w-[760px]">
          <div className="hero-mask pointer-events-none absolute inset-x-0 top-0 z-10 px-6 pb-20 pt-2">
            <h1 className="display text-3xl leading-tight sm:text-4xl lg:text-5xl">American influence, mapped</h1>
            <p className="mx-auto mt-3 max-w-xs text-[13px] leading-snug text-hero-ink-muted sm:max-w-sm sm:text-base">
              Who the U.S. is pressuring with tariffs and sanctions, and who it's formally aligned with.
            </p>
          </div>
          {summary ? (
            <Suspense fallback={<GlobePlaceholder />}>
              <PulseGlobe
                breakdown={breakdown}
                activeCountry={activeCountry}
                onSelect={onCountry}
                groupColorFor={blocGroupColorFor}
                describe={describe}
                legend={BLOC_GLOBE_LEGEND}
                ariaLabel="Globe of the United States and the countries it trades with, colored by alliance membership (NATO, G7, G20, BRICS, USMCA). Use the country list below to choose one."
              />
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
                  activeCountry === 'US' ? 'border-hero-btn-bg bg-hero-btn-bg text-hero-btn-text' : 'border-hero-border text-hero-ink hover:border-hero-border-strong hover:bg-hero-card-bg'
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
                    activeCountry === b.country ? 'border-hero-btn-bg bg-hero-btn-bg text-hero-btn-text' : 'border-hero-border text-hero-ink hover:border-hero-border-strong hover:bg-hero-card-bg'
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
                  actions={recent}
                  news={news}
                  onSeeAll={onSeeAll}
                  onClose={onClearCountry}
                />
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={onExplore} className="btn-hero">
                See pressure tools
              </button>
              <button type="button" onClick={onRefresh} disabled={syncing} className="btn-hero-ghost">
                {syncing ? 'Checking…' : 'Check for updates'}
              </button>
            </div>
            <p className="mt-4 text-base leading-snug text-hero-ink">
              <span className="font-semibold">{countryCount}</span> countries facing new U.S. tariffs, sanctions or export controls,{' '}
              <span className="font-semibold">{summary.last30}</span> pressure actions in total
              {summary.trendPct !== null && (
                <>
                  {' '}
                  (<PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct)}%`} className="font-semibold" />)
                </>
              )}
              {summary.leadingTag ? `, mostly ${summary.leadingTag.toLowerCase()}` : ''}.
            </p>
            <p className="mt-2 text-[13px] text-hero-ink-faint">{updatedText}</p>
          </>
        )}
      </div>
    </section>
  );
}
