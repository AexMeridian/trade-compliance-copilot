import { useMemo, useState } from 'react';
import type { AfroCountry, AfroOpinion } from '../lib/api';
import { nameFor } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { MeasureAtlas, type AtlasMeasure } from './MeasureAtlas';

// Extra Afrobarometer questions beyond the U.S. and China, each as a share of adults by country: how other powers' influence is rated,
// which power people say helped most with COVID-19, and which side they would take in the Russia-Ukraine war. One question per map.
const pct = (v: number) => `${v}%`;
const MEASURES: { id: string; group: string; label: string; of: (c: AfroCountry) => number | undefined; note: string }[] = [
  { id: 'ru', group: 'Influence rated positive', label: 'Russia', of: (c) => c.ru?.pos, note: 'Share who say Russia’s influence on their country is somewhat or very positive.' },
  { id: 'in', group: 'Influence rated positive', label: 'India', of: (c) => c.in?.pos, note: 'Share who say India’s influence on their country is somewhat or very positive.' },
  { id: 'eu', group: 'Influence rated positive', label: 'European Union', of: (c) => c.eu?.pos, note: 'Share who say the European Union’s influence is somewhat or very positive.' },
  { id: 'fc', group: 'Influence rated positive', label: 'Former colonial power', of: (c) => c.fc?.pos, note: 'Share who say the influence of their country’s former colonial power is somewhat or very positive. Not asked in every country.' },
  { id: 'cv-cn', group: 'Helped most with COVID-19', label: 'China', of: (c) => c.covid?.china, note: 'Share who name China as the country or organization that helped most with COVID-19.' },
  { id: 'cv-us', group: 'Helped most with COVID-19', label: 'United States', of: (c) => c.covid?.us, note: 'Share who name the United States as the country or organization that helped most with COVID-19.' },
  { id: 'cv-au', group: 'Helped most with COVID-19', label: 'African Union', of: (c) => c.covid?.au, note: 'Share who name the African Union or Africa CDC as the one that helped most with COVID-19.' },
  { id: 'ua-neutral', group: 'Russia-Ukraine war', label: 'Be neutral', of: (c) => c.ukraine?.neutral, note: 'Share who say their country should stay neutral, among adults who had heard of the war.' },
  { id: 'ua-ukraine', group: 'Russia-Ukraine war', label: 'Side with Ukraine', of: (c) => c.ukraine?.ukraine, note: 'Share who say their country should side with Ukraine, among adults who had heard of the war.' },
  { id: 'ua-russia', group: 'Russia-Ukraine war', label: 'Side with Russia', of: (c) => c.ukraine?.russia, note: 'Share who say their country should side with Russia, among adults who had heard of the war.' },
];

export function AfricaAtlas({ data }: { data: AfroOpinion }) {
  const [id, setId] = useState('ru');
  const [country, setCountry] = useState<string | null>(null);
  const m = MEASURES.find((x) => x.id === id) ?? MEASURES[0];

  const measure = useMemo<AtlasMeasure>(() => {
    const values: Record<string, number> = {};
    for (const [cc, c] of Object.entries(data.countries)) {
      const v = m.of(c);
      if (v !== undefined) values[cc] = v;
    }
    return { id: m.id, label: `${m.group}: ${m.label}`, kind: 'sequential', values, format: pct, asOf: 'Afrobarometer Round 10, 2024-25' };
  }, [data, m]);

  const ranked = Object.entries(measure.values).sort((a, b) => b[1] - a[1]);
  const groups = [...new Set(MEASURES.map((x) => x.group))];

  return (
    <div className="card min-w-0 px-4 pb-4 pt-4">
      <h3 className="text-[15px] font-semibold text-ink">Africa: other powers, COVID-19 and the war in Ukraine</h3>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        More questions from the same Afrobarometer survey, one map at a time. Each is a share of adults in that country; a country with no reading was not asked.
      </p>

      {groups.map((g) => (
        <div key={g} role="group" aria-label={g} className="mt-3">
          <p className="text-xs font-semibold text-ink-faint">{g}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MEASURES.filter((x) => x.group === g).map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={x.id === id}
                onClick={() => {
                  setId(x.id);
                  setCountry(null);
                }}
                className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${x.id === id ? 'border-ink bg-ink text-paper' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-ink-muted">{m.note}</p>
          {country && (
            <p className="mt-2 text-sm text-ink" aria-live="polite">
              <span className="font-semibold">{nameFor(country)}:</span> {measure.values[country] === undefined ? 'not asked or too few answers' : pct(measure.values[country])}
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
                <span className="font-semibold tabular-nums text-ink">{pct(v)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            Shares are weighted to each country's adults. About 1,200 to 2,400 adults were asked in each country, so a share can differ from the true figure by two to three points.
            "Don't know" counts in the base.
          </p>
        </div>
        <MeasureAtlas measure={measure} activeCountry={country} onSelect={setCountry} compact />
      </div>

      <ChartFooter
        source={data.name}
        sourceUrl={data.url}
        asOf="2024 to 2025"
        csv={{
          filename: 'aex-terminal-afrobarometer-more-items.csv',
          header: ['Country', ...MEASURES.map((x) => `${x.group}: ${x.label} (%)`)],
          rows: Object.entries(data.countries).map(([cc, c]) => [nameFor(cc), ...MEASURES.map((x) => x.of(c) ?? '')]),
        }}
      />
      <details className="mt-2 text-xs text-ink-faint">
        <summary className="cursor-pointer font-semibold hover:text-ink">How to cite these figures</summary>
        <p className="mt-1.5">{data.citation}</p>
      </details>
    </div>
  );
}
