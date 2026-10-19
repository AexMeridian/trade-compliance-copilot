import type { PowerIndicator } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';
import { nameFor, SERIES_COLORS } from '../lib/powerCountries';
import { DotStrip } from './DotStrip';

function Spark({ points, color }: { points: [number, number][]; color: string }) {
  if (points.length < 2) return null;
  const ys = points.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const x0 = points[0][0];
  const xSpan = points[points.length - 1][0] - x0 || 1;
  const d = points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(((x - x0) / xSpan) * 76 + 2).toFixed(1)} ${(20 - ((y - lo) / (hi - lo || 1)) * 16).toFixed(1)}`)
    .join(' ');
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// One indicator: what it is, each selected country's figure with its year and rank, where they sit among all
// countries, and (kept one click away, never hidden from the page) what the figure does not tell you.
export function IndicatorRow({ indicator, codes, showTable }: { indicator: PowerIndicator; codes: string[]; showTable: boolean }) {
  const hasAny = codes.some((c) => indicator.standings[c]);
  const years = [...new Set(codes.flatMap((c) => indicator.series[c]?.map((p) => p[0]) ?? []))].sort((a, b) => b - a);

  return (
    <article className="border-t border-hairline py-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h3 className="text-[15px] font-semibold text-ink">{indicator.label}</h3>
        <span className="text-xs text-ink-faint">Higher means {indicator.higherIs}</span>
      </div>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">{indicator.definition}</p>
      <p className="mt-0.5 text-xs text-ink-faint">
        Source:{' '}
        <a href={indicator.source.url} target="_blank" rel="noreferrer" className="text-ink-muted underline hover:text-ink">
          {indicator.source.name}
        </a>
      </p>

      <ul className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {codes.map((code, i) => {
          const s = indicator.standings[code];
          return (
            <li key={code} className="flex min-w-0 items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i] }} />
                  <span className="truncate">{nameFor(code)}</span>
                </p>
                {s ? (
                  <>
                    <p className="font-semibold tabular-nums text-ink">{formatValue(indicator.unit, s.value)}</p>
                    <p className="text-xs text-ink-faint">
                      {ordinal(s.rank)} of {s.of}, {s.year}
                    </p>
                  </>
                ) : (
                  <p className="font-semibold text-ink-faint">n/a</p>
                )}
              </div>
              <Spark points={indicator.series[code] ?? []} color={SERIES_COLORS[i]} />
            </li>
          );
        })}
      </ul>

      {hasAny && <DotStrip indicator={indicator} codes={codes} />}

      <details className="mt-2 text-[13px] text-ink-muted">
        <summary className="cursor-pointer text-xs font-semibold text-ink-faint hover:text-ink">What this does not tell you</summary>
        <p className="mt-1.5 max-w-3xl leading-relaxed">{indicator.caveat}</p>
      </details>

      {showTable && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-[13px]">
            <caption className="sr-only">{indicator.label}, by year</caption>
            <thead>
              <tr className="border-b border-hairline text-xs text-ink-faint">
                <th scope="col" className="py-1 pr-3 font-semibold">
                  Year
                </th>
                {codes.map((c) => (
                  <th key={c} scope="col" className="py-1 pr-3 font-semibold">
                    {nameFor(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={y} className="border-b border-hairline/60">
                  <th scope="row" className="py-1 pr-3 font-normal tabular-nums text-ink-muted">
                    {y}
                  </th>
                  {codes.map((c) => {
                    const v = indicator.series[c]?.find((p) => p[0] === y)?.[1];
                    return (
                      <td key={c} className="py-1 pr-3 tabular-nums text-ink">
                        {v === undefined ? <span className="text-ink-faint">n/a</span> : formatValue(indicator.unit, v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
