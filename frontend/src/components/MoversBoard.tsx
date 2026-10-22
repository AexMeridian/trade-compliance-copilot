import { useMemo, useState } from 'react';
import type { PowerIndicator } from '../lib/api';
import { formatValue } from '../lib/powerFormat';
import { nameFor } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { InfoPopover } from './InfoPopover';

export const MOVER_COUNTRIES = ['US', 'CN', 'RU', 'DE', 'FR', 'GB', 'JP', 'IN'];
const MEASURES = ['oda_given_usd', 'students_inbound', 'science_articles', 'coauthor_us', 'coauthor_cn', 'hdi'];
const SHORT: Record<string, string> = {
  oda_given_usd: 'Aid given',
  students_inbound: 'Students hosted',
  science_articles: 'Scientific articles',
  coauthor_us: 'Papers with U.S. researchers',
  coauthor_cn: 'Papers with Chinese researchers',
  hdi: 'Human development',
};

// The value a number of years before the latest one: the stored reading closest to `back` years earlier, within two years either side, or none.
const earlier = (series: [number, number][], latestYear: number, back: number) => {
  const target = latestYear - back;
  const near = series.filter((p) => Math.abs(p[0] - target) <= 2 && p[0] < latestYear).sort((a, b) => Math.abs(a[0] - target) - Math.abs(b[0] - target));
  return near[0];
};

// Who is rising and who is falling on measures the site already holds, over roughly the last five years, for the world's largest powers.
// Percent measures are shown as a change in points, everything else as a percent change. A country with no reading five years back is left
// out, not zeroed.
export function MoversBoard({ indicators }: { indicators: PowerIndicator[] }) {
  const options = MEASURES.map((id) => indicators.find((i) => i.id === id)).filter((i): i is PowerIndicator => !!i);
  const [id, setId] = useState(options[0]?.id ?? '');
  const ind = options.find((i) => i.id === id) ?? options[0];

  const rows = useMemo(() => {
    if (!ind) return [];
    return MOVER_COUNTRIES.map((cc) => {
      const s = ind.series[cc] ?? [];
      if (s.length === 0) return null;
      const last = s[s.length - 1];
      const before = earlier(s, last[0], 5);
      if (!before) return null;
      const points = ind.unit === 'pct' || ind.unit === 'points' || ind.unit === 'distance';
      const change = points ? last[1] - before[1] : before[1] ? ((last[1] - before[1]) / Math.abs(before[1])) * 100 : 0;
      return { cc, last, before, change, points };
    })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.change - a.change);
  }, [ind]);

  if (!ind) return null;
  const span = Math.max(1, ...rows.map((r) => Math.abs(r.change)));
  const fmtChange = (r: (typeof rows)[number]) => `${r.change > 0 ? '+' : ''}${r.points ? r.change.toFixed(ind.unit === 'distance' ? 3 : 1) : Math.round(r.change)}${r.points ? (ind.unit === 'pct' ? ' pts' : '') : '%'}`;

  return (
    <section aria-labelledby="movers-h" className="min-w-0">
      <h3 id="movers-h" className="font-display text-xl font-bold text-ink">
        Who is rising and who is falling
      </h3>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">Change over about five years on measures of exchange, knowledge and aid, for the eight countries most often compared. Each bar is one country's own change.</p>
      <div role="group" aria-label="Measure" className="mt-3 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={o.id === ind.id} onClick={() => setId(o.id)} className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${o.id === ind.id ? 'border-ink bg-ink text-paper' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}>
            {SHORT[o.id] ?? o.label}
          </button>
        ))}
      </div>
      <div className="card mt-3 min-w-0 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[15px] font-semibold text-ink">{ind.label}</p>
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
        <ol className="mt-3">
          {rows.map((r) => (
            <li key={r.cc} className="grid grid-cols-[6.5rem_minmax(0,1fr)_9rem] items-center gap-2 py-[3px] text-[13px] sm:grid-cols-[8rem_minmax(0,1fr)_12rem]">
              <span className="truncate text-ink">{nameFor(r.cc)}</span>
              <span className="relative h-3" aria-hidden="true">
                <span className="absolute left-1/2 top-0 h-full w-px bg-hairline-strong" />
                <span
                  className="absolute h-3 rounded-sm"
                  style={{
                    background: r.cc === 'US' ? 'var(--color-hue-blue-ink)' : r.cc === 'CN' ? 'var(--color-hue-orange-ink)' : 'var(--color-ink-faint)',
                    width: `${(Math.abs(r.change) / span) * 50}%`,
                    left: r.change < 0 ? `${50 - (Math.abs(r.change) / span) * 50}%` : '50%',
                  }}
                />
              </span>
              <span className="text-right text-[12px] tabular-nums text-ink-muted">
                <span className="font-semibold text-ink">{fmtChange(r)}</span> ({formatValue(ind.unit, r.before[1])} in {r.before[0]} to {formatValue(ind.unit, r.last[1])} in {r.last[0]})
              </span>
            </li>
          ))}
        </ol>
        <ChartFooter
          source={ind.source.name}
          sourceUrl={ind.source.url}
          asOf={ind.latestYear ? String(ind.latestYear) : undefined}
          csv={{
            filename: `aex-terminal-change-${ind.id}.csv`,
            header: ['Country', 'Earlier year', 'Earlier value', 'Latest year', 'Latest value', 'Change'],
            rows: rows.map((r) => [nameFor(r.cc), r.before[0], r.before[1], r.last[0], r.last[1], fmtChange(r)]),
          }}
        />
      </div>
    </section>
  );
}
