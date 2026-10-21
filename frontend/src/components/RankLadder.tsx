import type { PowerIndicator } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor, SERIES_COLORS } from '../lib/powerCountries';

// Where chosen countries stand on several measures, one row each. The track runs from the country ranked last (left) to the one ranked
// first (right), so a marker's place is its rank, not its raw value; the numbers beside it give both. Rows are never added up, and a
// country with no reading simply has no marker.
export function RankLadder({ indicators, codes }: { indicators: PowerIndicator[]; codes: string[] }) {
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        {codes.map((c, i) => (
          <li key={c} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: SERIES_COLORS[i] }} />
            {nameFor(c)}
          </li>
        ))}
        <li className="ml-auto text-ink-faint">Left: ranked last. Right: ranked first.</li>
      </ul>
      <ol className="divide-y divide-hairline">
        {indicators.map((ind) => (
          <li key={ind.id} className="grid items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,13rem)]">
            <p className="text-[13px] font-semibold leading-snug text-ink">{ind.label}</p>
            <div
              role="img"
              aria-label={`${ind.label}: ${codes.map((c) => { const s = ind.standings[c]; return s ? `${nameFor(c)} ${ordinal(s.rank)} of ${s.of}` : `${nameFor(c)} no reading`; }).join('; ')}`}
              className="relative h-6"
            >
              <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-hairline" />
              <span className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-hairline-strong" />
              {codes.map((c, i) => {
                const s = ind.standings[c];
                if (!s) return null;
                const pct = s.of > 1 ? (1 - (s.rank - 1) / (s.of - 1)) * 100 : 50;
                return (
                  <span
                    key={c}
                    title={`${nameFor(c)}: ${formatValue(ind.unit, s.value)}, ${ordinal(s.rank)} of ${s.of}`}
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper-raised"
                    style={{ left: `${Math.max(2, Math.min(98, pct))}%`, background: SERIES_COLORS[i] }}
                  />
                );
              })}
            </div>
            <p className="text-[12px] tabular-nums text-ink-muted">
              {codes.map((c, i) => {
                const s = ind.standings[c];
                return (
                  <span key={c} className="mr-3 inline-block whitespace-nowrap">
                    <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                    {s ? <span className="text-ink">{formatValue(ind.unit, s.value)}</span> : <span className="text-ink-faint">n/a</span>}
                  </span>
                );
              })}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
