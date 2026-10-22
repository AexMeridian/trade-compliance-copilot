import { useMemo, useState } from 'react';
import type { TrendsResponse } from '../lib/api';
import { nameFor } from '../lib/powerCountries';
import { ChartFooter } from './ChartFooter';
import { InfoPopover } from './InfoPopover';
import { SUBJECT_COLOR, TrendChart, type ChartEvent } from './TrendChart';

type Pew = TrendsResponse['pew'];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const valueAt = (series: [number, number][] | undefined, year: number) => series?.find((p) => p[0] === year)?.[1];

// The same countries, year after year: the median favorable view of the U.S. (and of China, where Pew asked) among the countries Pew polled in
// every year shown. Holding the countries fixed is what makes a rise or fall mean something; Pew's own medians change country sets from
// year to year. This is this site's median of Pew's published country figures, not a Pew figure, and the panel is listed.
function panelMedians(pew: Pew, countries: string[], years: number[], which: 'us' | 'cn'): [number, number][] {
  const data = which === 'us' ? pew.usFavorable : pew.cnFavorable;
  const out: [number, number][] = [];
  for (const y of years) {
    const vals = countries.map((c) => valueAt(data[c], y));
    if (vals.every((v) => v !== undefined)) out.push([y, Math.round(median(vals as number[]))]);
  }
  return out;
}

const WINDOWS = [
  { id: 'long', label: 'Since 2007', from: 2007, need: [2007] },
  { id: 'recent', label: 'Since 2017', from: 2017, need: [] as number[] },
] as const;

export function PewTrendPanel({ pew, events }: { pew: Pew; events: ChartEvent[] }) {
  const [win, setWin] = useState<'long' | 'recent'>('long');
  const [since, setSince] = useState<2017 | 2024>(2024);
  const w = WINDOWS.find((x) => x.id === win)!;

  const view = useMemo(() => {
    const allYears = [...new Set(Object.values(pew.usFavorable).flatMap((s) => s.map((p) => p[0])))].filter((y) => y >= w.from).sort((a, b) => a - b);
    // A country joins the panel if it has a U.S. reading for the start year (for the long window) and for every year from 2017 on.
    const recentYears = allYears.filter((y) => y >= 2017);
    const panel = Object.keys(pew.usFavorable).filter((c) => [...w.need, ...recentYears].every((y) => valueAt(pew.usFavorable[c], y) !== undefined));
    const years = allYears.filter((y) => panel.every((c) => valueAt(pew.usFavorable[c], y) !== undefined));
    return { panel, us: panelMedians(pew, panel, years, 'us'), cn: panelMedians(pew, panel, years, 'cn') };
  }, [pew, w]);

  const lines = [
    { id: 'us', label: 'United States', color: SUBJECT_COLOR.US, points: view.us },
    { id: 'cn', label: 'China', color: SUBJECT_COLOR.CN, points: view.cn },
  ].filter((l) => l.points.length > 0);

  // Where the U.S. image moved most since a chosen year, with China's move alongside for the same countries.
  const movers = useMemo(() => {
    const latest = 2026;
    return Object.keys(pew.usFavorable)
      .map((cc) => {
        const us0 = valueAt(pew.usFavorable[cc], since);
        const us1 = valueAt(pew.usFavorable[cc], latest);
        const cn0 = valueAt(pew.cnFavorable[cc], since);
        const cn1 = valueAt(pew.cnFavorable[cc], latest);
        if (us0 === undefined || us1 === undefined) return null;
        return { cc, us0, us1, usChange: us1 - us0, cnChange: cn0 !== undefined && cn1 !== undefined ? cn1 - cn0 : null };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.usChange - b.usChange);
  }, [pew, since]);
  const span = Math.max(20, ...movers.flatMap((m) => [Math.abs(m.usChange), Math.abs(m.cnChange ?? 0)]));

  const csv = movers.map((m) => [nameFor(m.cc), m.us0, m.us1, m.usChange, m.cnChange ?? '']);

  return (
    <section aria-labelledby="pew-trend-h" className="min-w-0">
      <h3 id="pew-trend-h" className="font-display text-xl font-bold text-ink">
        Views of the U.S. and China, in the same countries over time
      </h3>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Pew Research Center asks adults in dozens of countries every spring whether they have a favorable view of each country. Holding the countries fixed is what lets a rise or a fall mean
        something.
      </p>

      <div className="card mt-3 min-w-0 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[15px] font-semibold text-ink">Median favorable view in {view.panel.length} countries Pew polled every year shown</p>
          <div role="group" aria-label="Time window" className="inline-flex border border-hairline-strong text-sm">
            {WINDOWS.map((o) => (
              <button key={o.id} type="button" aria-pressed={win === o.id} onClick={() => setWin(o.id)} className={`px-3 py-1 font-semibold ${win === o.id ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <TrendChart lines={lines} format={(v) => `${Math.round(v)}%`} events={events} min={0} max={100} ariaLabel="Median share with a favorable view of the United States and of China in the same countries, by year." />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          Countries: {view.panel.map((c) => nameFor(c)).join(', ')}. A year appears only when Pew asked every one of these countries. Medians are this site's calculation from Pew's published country
          figures, so they will not match Pew's own medians, which cover different countries each year.
        </p>
        <ChartFooter
          source={`${pew.us.name}; ${pew.cn.name}`}
          sourceUrl={pew.us.url}
          asOf={`${pew.us.release}; ${pew.cn.release}`}
          csv={{
            filename: 'aex-terminal-pew-fixed-panel-medians.csv',
            header: ['Year', 'United States, median favorable (%)', 'China, median favorable (%)'],
            rows: [...new Set([...view.us, ...view.cn].map((p) => p[0]))].sort((a, b) => a - b).map((y) => [y, view.us.find((p) => p[0] === y)?.[1] ?? '', view.cn.find((p) => p[0] === y)?.[1] ?? '']),
          }}
        />
        <p className="mt-2 text-xs text-ink-faint">{pew.disclaimer}</p>
      </div>

      <div className="card mt-4 min-w-0 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold text-ink">Where the U.S. image has moved most</p>
            <p className="mt-0.5 text-[13px] text-ink-muted">Change in the share with a favorable view of the U.S., {since} to 2026, in points. China's change is alongside where Pew asked.</p>
          </div>
          <div role="group" aria-label="Compare from" className="inline-flex border border-hairline-strong text-sm">
            {([2024, 2017] as const).map((y) => (
              <button key={y} type="button" aria-pressed={since === y} onClick={() => setSince(y)} className={`px-3 py-1 font-semibold ${since === y ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink'}`}>
                Since {y}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 rounded-sm" style={{ background: SUBJECT_COLOR.US }} /> Views of the U.S.
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 rounded-sm" style={{ background: SUBJECT_COLOR.CN }} /> Views of China
          </li>
        </ul>
        <ol className="mt-2">
          {movers.map((m) => (
            <li key={m.cc} className="grid grid-cols-[6.5rem_minmax(0,1fr)_7.5rem] items-center gap-2 py-[3px] text-[13px] sm:grid-cols-[9rem_minmax(0,1fr)_9rem]">
              <span className="truncate text-ink" title={nameFor(m.cc)}>
                {nameFor(m.cc)}
              </span>
              <span className="relative h-5" aria-hidden="true">
                <span className="absolute left-1/2 top-0 h-full w-px bg-hairline-strong" />
                <Bar change={m.usChange} span={span} color={SUBJECT_COLOR.US} top />
                {m.cnChange !== null && <Bar change={m.cnChange} span={span} color={SUBJECT_COLOR.CN} />}
              </span>
              <span className="text-right text-[12px] tabular-nums text-ink-muted">
                <span className="text-ink">
                  {m.usChange > 0 ? '+' : ''}
                  {m.usChange}
                </span>{' '}
                ({m.us0}% to {m.us1}%)
                {m.cnChange !== null && (
                  <span className="block">
                    China {m.cnChange > 0 ? '+' : ''}
                    {m.cnChange}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
        <ChartFooter
          source={pew.us.name}
          sourceUrl={pew.us.url}
          asOf={pew.us.release}
          csv={{ filename: `aex-terminal-pew-change-since-${since}.csv`, header: ['Country', `U.S. favorable ${since} (%)`, 'U.S. favorable 2026 (%)', 'Change (points)', 'China change (points)'], rows: csv }}
        />
        <div className="mt-1">
          <InfoPopover label="About this chart">
            <p>Each bar is the difference between two Pew survey readings for the same country. A country appears only if Pew asked the question in both years. Survey mode changed in some countries over time (for example the U.S. and Australia moved online), so small changes should not be over-read.</p>
          </InfoPopover>
        </div>
      </div>
    </section>
  );
}

function Bar({ change, span, color, top = false }: { change: number; span: number; color: string; top?: boolean }) {
  const half = Math.min(50, (Math.abs(change) / span) * 50);
  return (
    <span
      className="absolute h-[9px] rounded-sm"
      style={{ background: color, top: top ? 0 : 11, width: `${half}%`, left: change < 0 ? `${50 - half}%` : '50%' }}
    />
  );
}
