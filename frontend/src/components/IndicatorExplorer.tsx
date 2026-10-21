import { useId, useMemo, useRef, useState } from 'react';
import type { PowerIndicator } from '../lib/api';
import { atlasFromIndicator } from '../lib/softPowerMeasures';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor, POWER_CODES, SERIES_COLORS } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { InfoPopover } from './InfoPopover';
import { MeasureAtlas } from './MeasureAtlas';
import { Sparkline } from './Sparkline';

const TOP = 10;

// One measure open at a time across the whole world: a card grid to choose from (each card shows the U.S. and China at a glance), and
// the chosen measure opened above it as a shaded globe, a ranking and a country lookup. Comparing chosen countries side by side
// is the Compare tab; nothing here is added into a score.
export function IndicatorExplorer({
  indicators,
  heading,
  blurb,
  codes = ['US', 'CN'],
}: {
  indicators: PowerIndicator[];
  heading: string;
  blurb: string;
  codes?: string[];
}) {
  const shown = useMemo(() => indicators.filter((i) => i.distribution.length > 0), [indicators]);
  const uid = useId();
  const detailRef = useRef<HTMLDivElement>(null);
  const [id, setId] = useState(shown[0]?.id ?? '');
  const [country, setCountry] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const ind = shown.find((i) => i.id === id) ?? shown[0];
  const measure = useMemo(() => (ind ? atlasFromIndicator(ind) : null), [ind]);
  if (!ind || !measure) return <p className="text-sm text-ink-faint">These measures have not been loaded yet. They refresh weekly.</p>;

  const ranked = [...ind.distribution].sort((a, b) => b[1] - a[1]);
  const lo = Math.min(0, ranked[ranked.length - 1][1]);
  const hi = ranked[0][1];
  const width = (v: number) => `${Math.max(1.5, ((v - lo) / (hi - lo || 1)) * 100).toFixed(1)}%`;
  const rank = country ? ranked.findIndex(([cc]) => cc === country) + 1 : 0;
  const extra = country && rank > TOP ? { cc: country, v: ranked[rank - 1][1], rank } : null;
  const q = query.trim().toLowerCase();
  const cards = q ? shown.filter((i) => i.label.toLowerCase().includes(q)) : shown;

  const choose = (next: string) => {
    setId(next);
    setCountry(null);
    const el = detailRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const bar = (cc: string, v: number, n: number, highlight: boolean) => (
    <li key={cc} className={`flex items-center gap-2 py-1 text-[13px] ${highlight ? 'font-semibold' : ''}`}>
      <span className="w-6 shrink-0 text-right tabular-nums text-ink-faint">{n}</span>
      <button type="button" onClick={() => setCountry(cc)} className="w-28 shrink-0 truncate text-left text-ink hover:underline sm:w-36" title={nameFor(cc)}>
        {nameFor(cc)}
      </button>
      <span className="h-2.5 min-w-0 flex-1 rounded-full bg-hairline" aria-hidden="true">
        <span className={`block h-2.5 rounded-full ${highlight ? 'bg-hue-orange' : 'bg-soft'}`} style={{ width: width(v) }} />
      </span>
      <span className="w-24 shrink-0 text-right tabular-nums text-ink">{formatValue(ind.unit, v)}</span>
    </li>
  );

  return (
    <section aria-labelledby={`${uid}-h`} className="min-w-0">
      <h3 id={`${uid}-h`} className="font-display text-xl font-bold text-ink">
        {heading}
      </h3>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">{blurb}</p>

      <div ref={detailRef} className="card mt-4 scroll-mt-28 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline bg-soft-tint px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-tight text-ink">{ind.label}</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Higher means {ind.higherIs}. {ind.latestYear ? `${ind.latestYear}, ` : ''}
              {ind.distribution.length} countries.
            </p>
          </div>
          <InfoPopover label={`About ${ind.label}`} align="right">
            <p>{ind.definition}</p>
            <p className="mt-2 font-semibold text-ink">What this does not tell you</p>
            <p>{ind.caveat}</p>
            <p className="mt-2">
              Source:{' '}
              <a href={ind.source.url} target="_blank" rel="noreferrer" className="text-ink underline">
                {ind.source.name}
              </a>
            </p>
          </InfoPopover>
        </div>

        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`${uid}-look`} className="text-xs font-semibold text-ink-muted">
                Look up a country
              </label>
              <select id={`${uid}-look`} value={country ?? ''} onChange={(e) => setCountry(e.target.value || null)} className="border border-hairline-strong bg-paper-raised px-2 py-1 text-[13px]">
                <option value="">Choose…</option>
                {POWER_CODES.map((c) => (
                  <option key={c} value={c}>
                    {nameFor(c)}
                  </option>
                ))}
              </select>
              {country && (
                <p className="text-[13px] text-ink" aria-live="polite">
                  <span className="font-semibold">{nameFor(country)}:</span> {rank ? `${formatValue(ind.unit, ranked[rank - 1][1])}, ${ordinal(rank)} of ${ranked.length}` : 'no reading'}
                </p>
              )}
            </div>
            <p className="mt-3 text-xs font-semibold text-ink-faint">Highest {TOP}</p>
            <ol className="mt-1">
              {ranked.slice(0, TOP).map(([cc, v], i) => bar(cc, v, i + 1, cc === country))}
              {extra && (
                <>
                  <li aria-hidden="true" className="py-0.5 pl-8 text-ink-faint">
                    …
                  </li>
                  {bar(extra.cc, extra.v, extra.rank, true)}
                </>
              )}
            </ol>
          </div>
          <MeasureAtlas measure={measure} activeCountry={country} onSelect={setCountry} compact />
        </div>

        <div className="px-4 pb-4">
          <ChartFooter
            source={ind.source.name}
            sourceUrl={ind.source.url}
            asOf={ind.latestYear ? String(ind.latestYear) : undefined}
            csv={{ filename: `aex-terminal-${ind.id}.csv`, header: ['Country', `${ind.label} (${ind.latestYear ?? ''})`], rows: ranked.map(([cc, v]) => [nameFor(cc), v]) }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Choose a measure</p>
        {shown.length > 6 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter measures"
            aria-label={`Filter ${heading} measures`}
            className="w-48 border border-hairline-strong bg-paper-raised px-2.5 py-1.5 text-[13px]"
          />
        )}
      </div>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((i) => {
          const on = i.id === ind.id;
          const spark = i.series[codes[0]] ?? [];
          return (
            <li key={i.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => choose(i.id)}
                className={`card flex h-full w-full min-w-0 flex-col gap-2 p-3 text-left transition-colors hover:border-soft ${on ? 'border-soft bg-soft-tint' : ''}`}
              >
                <span className="line-clamp-2 min-h-[2.5rem] text-[14px] font-semibold leading-snug text-ink">{i.label}</span>
                <span className="grid grid-cols-2 gap-2">
                  {codes.slice(0, 2).map((c, k) => {
                    const s = i.standings[c];
                    return (
                      <span key={c} className="min-w-0">
                        <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: SERIES_COLORS[k] }} />
                          <span className="truncate">{nameFor(c)}</span>
                        </span>
                        {s ? (
                          <>
                            <span className="block truncate text-[15px] font-semibold tabular-nums text-ink">{formatValue(i.unit, s.value)}</span>
                            <span className="block text-[11px] text-ink-muted">{ordinal(s.rank)} of {s.of}</span>
                          </>
                        ) : (
                          <span className="block text-[15px] font-semibold text-ink-muted">n/a</span>
                        )}
                      </span>
                    );
                  })}
                </span>
                <span className="mt-auto flex items-end justify-between">
                  <span className="text-[11px] text-ink-muted">{i.latestYear ?? ''}</span>
                  <Sparkline points={spark} color={SERIES_COLORS[0]} width={90} height={26} fill />
                </span>
              </button>
            </li>
          );
        })}
        {cards.length === 0 && <li className="text-sm text-ink-faint">No measure matches that.</li>}
      </ul>
    </section>
  );
}
