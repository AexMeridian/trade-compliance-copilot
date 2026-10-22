import { useState } from 'react';
import type { TrendsResponse } from '../lib/api';
import { nameFor } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { SUBJECT_COLOR } from './TrendChart';

const YEARS = [2024, 2025, 2026] as const;

const pearson = (pts: [number, number][]) => {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p[0], 0) / n;
  const my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pts) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
};

const W = 520;
const H = 340;
const PAD = { l: 40, r: 14, t: 12, b: 38 };

// A country-by-country picture of what sits alongside views of the U.S.: the share confident in the U.S. president against the share with a
// favorable view of the country. Each dot is one country in one year. The correlation is this site's calculation from the 20 pairs. It shows
// the two move together; it cannot say which drives which, and the person asked about changed (Biden in 2024, Trump in 2025 and 2026).
export function DriverScatter({ drivers }: { drivers: TrendsResponse['pew']['drivers'] }) {
  const [yi, setYi] = useState<0 | 1 | 2>(2);
  const [hover, setHover] = useState<string | null>(null);
  const entries = Object.entries(drivers.countries);
  const pts = entries.map(([cc, v]) => ({ cc, x: v.confidence[yi], y: v.favorable[yi] }));
  const r = pearson(pts.map((p) => [p.x, p.y]));
  const rs = YEARS.map((_, i) => pearson(entries.map(([, v]) => [v.confidence[i], v.favorable[i]] as [number, number])));
  const x = (v: number) => PAD.l + (v / 100) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const hot = hover ? pts.find((p) => p.cc === hover) : undefined;

  return (
    <div className="card min-w-0 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold text-ink">Confidence in the U.S. president and views of the U.S., 20 countries</p>
          <p className="mt-0.5 max-w-2xl text-[13px] text-ink-muted">
            Countries where more people trust the U.S. president to do the right thing on world affairs also tend to like the U.S. more. Pew reports the two have become more strongly linked.
          </p>
        </div>
        <div role="group" aria-label="Survey year" className="inline-flex border border-hairline-strong text-sm">
          {YEARS.map((yr, i) => (
            <button key={yr} type="button" aria-pressed={yi === i} onClick={() => setYi(i as 0 | 1 | 2)} className={`px-3 py-1 font-semibold ${yi === i ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`}>
              {yr}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 min-h-[1.5rem] text-[13px] text-ink-muted" aria-live="polite">
        {hot ? (
          <>
            <span className="font-semibold text-ink">{nameFor(hot.cc)}:</span> {hot.y}% favorable view of the U.S., {hot.x}% confident in the president.
          </>
        ) : (
          `Correlation across the 20 countries in ${YEARS[yi]}: ${r.toFixed(2)} (this site's calculation). For 2024, 2025 and 2026: ${rs.map((v) => v.toFixed(2)).join(', ')}.`
        )}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scatter of confidence in the U.S. president against favorable view of the U.S. for 20 countries in ${YEARS[yi]}. The numbers are in the table below.`} className="mt-1 block h-auto w-full max-w-[640px]">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" />
            <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-hairline)" />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-muted)">
              {t}%
            </text>
            <text x={x(t)} y={H - PAD.b + 14} textAnchor="middle" fontSize="10" fill="var(--color-ink-muted)">
              {t}%
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} stroke="var(--color-hairline-strong)" strokeDasharray="4 4" />
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">
          Confident in the U.S. president
        </text>
        <text transform={`translate(11 ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">
          Favorable view of the U.S.
        </text>
        {pts.map((p) => (
          <g key={p.cc} onMouseEnter={() => setHover(p.cc)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(p.x)} cy={y(p.y)} r={hover === p.cc ? 7 : 5} fill={SUBJECT_COLOR.US} fillOpacity="0.85" stroke="var(--color-paper-raised)" strokeWidth="1.5" />
            <text x={x(p.x) + 8} y={y(p.y) + 3} fontSize="9.5" fill="var(--color-ink)">
              {p.cc}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[12px] text-ink-muted">Dashed line: where the two shares would be equal. The president asked about was Joe Biden in 2024 and Donald Trump in 2025 and 2026, so a change between years mixes a change in view with a change in person.</p>

      <details className="mt-2 text-xs text-ink-muted">
        <summary className="cursor-pointer font-semibold hover:text-ink">The same numbers as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-left text-[13px]">
            <caption className="sr-only">Favorable view of the U.S. and confidence in the U.S. president, by country, 2024 to 2026</caption>
            <thead>
              <tr className="border-b border-hairline text-xs">
                <th scope="col" className="py-1 pr-3 font-semibold">Country</th>
                {YEARS.map((yr) => (
                  <th key={yr} scope="col" className="py-1 pr-3 font-semibold">{yr}: favorable / confident</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(([cc, v]) => (
                <tr key={cc} className="border-b border-hairline/60">
                  <th scope="row" className="py-1 pr-3 font-normal text-ink-muted">{nameFor(cc)}</th>
                  {YEARS.map((yr, i) => (
                    <td key={yr} className="py-1 pr-3 tabular-nums text-ink">{v.favorable[i]}% / {v.confidence[i]}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <ChartFooter
        source={drivers.source.name}
        sourceUrl={drivers.source.url}
        asOf="Spring 2026 Global Attitudes Survey"
        csv={{
          filename: 'aex-terminal-pew-favorable-vs-confidence.csv',
          header: ['Country', ...YEARS.flatMap((yr) => [`Favorable ${yr} (%)`, `Confident ${yr} (%)`])],
          rows: entries.map(([cc, v]) => [nameFor(cc), ...YEARS.flatMap((_, i) => [v.favorable[i], v.confidence[i]])]),
        }}
      />
      <details className="mt-2 text-xs text-ink-faint">
        <summary className="cursor-pointer font-semibold hover:text-ink">How to cite these figures</summary>
        <p className="mt-1.5">{drivers.source.citation}</p>
      </details>
    </div>
  );
}
