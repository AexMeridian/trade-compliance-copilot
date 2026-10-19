import { useMemo, useState } from 'react';
import type { PowerIndicator } from '../lib/api';
import { atlasFromIndicator } from '../lib/softPowerMeasures';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor, POWER_CODES } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { MeasureAtlas } from './MeasureAtlas';

// One measure at a time across the whole world: pick it, see every country shaded on the map, the top of the ranking, and what the
// figure does and does not tell you. This is the world view; comparing chosen countries side by side is the Compare tab.
export function IndicatorExplorer({ indicators, heading, blurb }: { indicators: PowerIndicator[]; heading: string; blurb: string }) {
  const shown = indicators.filter((i) => i.distribution.length > 0);
  const [id, setId] = useState(shown[0]?.id ?? '');
  const [country, setCountry] = useState<string | null>(null);
  const ind = shown.find((i) => i.id === id) ?? shown[0];
  const measure = useMemo(() => (ind ? atlasFromIndicator(ind) : null), [ind]);
  if (!ind || !measure) return <p className="text-sm text-ink-faint">These measures have not been loaded yet. They refresh weekly.</p>;

  const ranked = [...ind.distribution].sort((a, b) => b[1] - a[1]);
  const rank = country ? ranked.findIndex(([cc]) => cc === country) + 1 : 0;
  const mine = country ? ranked.find(([cc]) => cc === country) : undefined;

  return (
    <section aria-labelledby={`explore-${heading}`} className="min-w-0">
      <h3 id={`explore-${heading}`} className="font-display text-xl font-bold text-ink">
        {heading}
      </h3>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">{blurb}</p>

      <div role="group" aria-label={`${heading} measures`} className="mt-3 flex flex-wrap gap-1.5">
        {shown.map((i) => (
          <button
            key={i.id}
            type="button"
            aria-pressed={i.id === ind.id}
            onClick={() => setId(i.id)}
            className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${i.id === ind.id ? 'border-ink bg-ink text-paper' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
          >
            {i.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-ink-muted">{ind.definition}</p>
          <p className="mt-1 text-xs text-ink-faint">
            Higher means {ind.higherIs}. Latest year {ind.latestYear ?? 'n/a'}, {ind.distribution.length} countries. Source:{' '}
            <a href={ind.source.url} target="_blank" rel="noreferrer" className="text-ink-muted underline hover:text-ink">
              {ind.source.name}
            </a>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor={`look-${ind.id}`} className="text-xs font-semibold text-ink-muted">
              Look up a country
            </label>
            <select
              id={`look-${ind.id}`}
              value={country ?? ''}
              onChange={(e) => setCountry(e.target.value || null)}
              className="border border-hairline-strong bg-paper-raised px-2 py-1 text-[13px]"
            >
              <option value="">Choose…</option>
              {POWER_CODES.map((c) => (
                <option key={c} value={c}>
                  {nameFor(c)}
                </option>
              ))}
            </select>
          </div>
          {country && (
            <p className="mt-2 text-sm text-ink" aria-live="polite">
              <span className="font-semibold">{nameFor(country)}:</span> {mine ? `${formatValue(ind.unit, mine[1])}, ${ordinal(rank)} of ${ranked.length}` : 'no reading for this measure'}
            </p>
          )}

          <ol className="mt-3 border-t border-hairline">
            {ranked.slice(0, 10).map(([cc, v], i) => (
              <li key={cc} className="flex items-center justify-between gap-3 border-b border-hairline/60 py-1.5 text-[13px]">
                <span className="flex items-center gap-2 text-ink">
                  <span className="w-5 text-right tabular-nums text-ink-faint">{i + 1}</span>
                  <button type="button" onClick={() => setCountry(cc)} className="text-left hover:underline">
                    {nameFor(cc)}
                  </button>
                </span>
                <span className="tabular-nums font-semibold text-ink">{formatValue(ind.unit, v)}</span>
              </li>
            ))}
          </ol>

          <details className="mt-3 text-[13px] text-ink-muted">
            <summary className="cursor-pointer text-xs font-semibold text-ink-faint hover:text-ink">What this does not tell you</summary>
            <p className="mt-1.5 leading-relaxed">{ind.caveat}</p>
          </details>
        </div>

        <MeasureAtlas measure={measure} activeCountry={country} onSelect={setCountry} compact />
      </div>

      <ChartFooter
        source={ind.source.name}
        sourceUrl={ind.source.url}
        asOf={ind.latestYear ? String(ind.latestYear) : undefined}
        csv={{
          filename: `aex-terminal-${ind.id}.csv`,
          header: ['Country', `${ind.label} (${ind.latestYear ?? ''})`],
          rows: ranked.map(([cc, v]) => [nameFor(cc), v]),
        }}
      />
    </section>
  );
}
