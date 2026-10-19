import { useEffect, useMemo, useState } from 'react';
import { getTies, type TiesResponse } from '../lib/api';
import { nameFor } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { MeasureAtlas, type AtlasMeasure } from './MeasureAtlas';

const PARTNER: Record<string, { label: string; place: string }> = {
  US: { label: 'U.S.', place: 'the United States' },
  GB: { label: 'U.K.', place: 'the United Kingdom' },
  FR: { label: 'France', place: 'France' },
  ES: { label: 'Spain', place: 'Spain' },
  PT: { label: 'Portugal', place: 'Portugal' },
  RU: { label: 'Russia', place: 'Russia' },
  CN: { label: 'China', place: 'China' },
};

// Distinct hues for four named classes (identity, not magnitude), with a quiet slate for "neither".
const CLASSES = [
  { color: '#f59e0b', label: 'Official language and colonial history' },
  { color: '#5fd0dd', label: 'Shares an official language' },
  { color: '#c084fc', label: 'Colonial history only' },
  { color: '#3b4658', label: 'Neither' },
];

// Which countries share an official language with each of seven powers, and which have a colonial history with them. A footprint of
// history and culture, not a measure of affection: the page says so, and the map is one partner at a time.
export function LanguageTies() {
  const [data, setData] = useState<TiesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [partner, setPartner] = useState('FR');
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTies()
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const values: Record<string, number> = {};
    let lang = 0;
    let col = 0;
    for (const [cc, t] of Object.entries(data.ties)) {
      if (cc === partner) continue;
      const l = t.lang.includes(partner);
      const c = t.colony.includes(partner);
      values[cc] = l && c ? 0 : l ? 1 : c ? 2 : 3;
      if (l) lang++;
      if (c) col++;
    }
    const measure: AtlasMeasure = {
      id: `ties-${partner}`,
      label: `Language and colonial ties with ${PARTNER[partner].place}`,
      kind: 'categorical',
      values,
      classes: CLASSES,
      format: (v) => CLASSES[Math.round(v)].label,
    };
    return { measure, lang, col, total: Object.keys(values).length };
  }, [data, partner]);

  if (failed) return <p className="text-sm text-ink-faint">Couldn't load the language and history data.</p>;
  if (!data || !view) return <p className="text-sm text-ink-faint">Loading…</p>;
  const p = PARTNER[partner];

  return (
    <section aria-labelledby="ties-title" className="min-w-0">
      <h3 id="ties-title" className="font-display text-xl font-bold text-ink">
        Shared language and history
      </h3>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">
        Which countries share an official language with a major power, and which share a colonial past with it. Pick a power to see the map.
      </p>

      <div role="group" aria-label="Partner power" className="mt-3 flex flex-wrap gap-1.5">
        {data.partners.map((cc) => (
          <button
            key={cc}
            type="button"
            aria-pressed={cc === partner}
            onClick={() => {
              setPartner(cc);
              setCountry(null);
            }}
            className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${cc === partner ? 'border-ink bg-ink text-paper' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
          >
            {PARTNER[cc]?.label ?? cc}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <p className="text-[15px] leading-snug text-ink" aria-live="polite">
            <span className="font-semibold tabular-nums">{view.lang}</span> of {view.total} countries share an official language with {p.place};{' '}
            <span className="font-semibold tabular-nums">{view.col}</span> have a colonial history with it.
          </p>
          {country && data.ties[country] && (
            <p className="mt-2 text-sm text-ink">
              <span className="font-semibold">{nameFor(country)}:</span> {data.ties[country].lang.includes(partner) ? 'shares an official language' : 'no shared official language'};{' '}
              {data.ties[country].colony.includes(partner) ? 'colonial history together.' : 'no colonial history together.'}
            </p>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">{data.source.caveat}</p>
          <ChartFooter
            source={data.source.name}
            sourceUrl={data.source.url}
            csv={{
              filename: `aex-terminal-language-colonial-ties-${partner.toLowerCase()}.csv`,
              header: ['Country', `Shares an official language with ${p.label}`, `Colonial history with ${p.label}`],
              rows: Object.entries(data.ties)
                .filter(([cc]) => cc !== partner)
                .map(([cc, t]) => [nameFor(cc), t.lang.includes(partner) ? 'yes' : 'no', t.colony.includes(partner) ? 'yes' : 'no']),
            }}
          />
          <details className="mt-2 text-xs text-ink-faint">
            <summary className="cursor-pointer font-semibold hover:text-ink">How to cite</summary>
            <p className="mt-1.5">{data.source.citation}</p>
          </details>
        </div>
        <MeasureAtlas measure={view.measure} activeCountry={country} onSelect={setCountry} compact />
      </div>
    </section>
  );
}
