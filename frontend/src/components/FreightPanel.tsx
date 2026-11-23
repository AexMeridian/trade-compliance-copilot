import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChartFooter } from './ChartFooter';
import { PulsePanel } from './PulsePanel';
import { getFreight, type FreightResponse } from '../lib/api';

// Freight and supply-chain indicators: the New York Fed's Global Supply Chain Pressure Index and IMF PortWatch vessel transits through the
// chokepoints that carry U.S. trade. Both are stored by the daily job; nothing here calls a model. The chokepoint choice lives in the URL
// (?cp=), so the chart link can be shared.

type Pt = [string, number];
const SINCE = '2019-01-01';
const fmtMonth = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function DateLine({ points, format, label, readoutLabel, zeroLine = false, weekly = false }: { points: Pt[]; format: (v: number) => string; label: string; readoutLabel: string; zeroLine?: boolean; weekly?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) return <p className="text-sm text-ink-faint">Not enough history yet.</p>;
  const H = 220;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const ts = points.map(([d]) => Date.parse(d));
  const vs = points.map(([, v]) => v);
  const lo = zeroLine ? Math.min(0, ...vs) : Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const yLo = lo - span * 0.05;
  const yHi = hi + span * 0.05;
  const x = (t: number) => pad.l + ((t - ts[0]) / (ts[ts.length - 1] - ts[0] || 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yLo) / (yHi - yLo)) * (H - pad.t - pad.b);
  const line = points.map(([d, v]) => `${x(Date.parse(d)).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const yTicks = [lo, (lo + hi) / 2, hi];
  const xTicks = [0, Math.floor(points.length / 2), points.length - 1];
  const at = (clientX: number, left: number) => {
    const t = ts[0] + ((clientX - left - pad.l) / (width - pad.l - pad.r)) * (ts[ts.length - 1] - ts[0]);
    let best = 0;
    for (let i = 1; i < ts.length; i++) if (Math.abs(ts[i] - t) < Math.abs(ts[best] - t)) best = i;
    setHover(best);
  };
  const when = (d: string) => (weekly ? `Week of ${fmtDay(d)}` : fmtMonth(d));
  const shown = hover ?? points.length - 1;
  return (
    <div ref={box} className="w-full">
      <p className="mb-1 min-h-[1.25rem] text-[13px] text-ink-muted" aria-live="polite">
        <span className="font-semibold text-ink">{when(points[shown][0])}:</span> {format(points[shown][1])} {readoutLabel}
        {hover === null && ' (latest). Move over the chart, or use the arrow keys, to read another point.'}
      </p>
      <svg
        width={width}
        height={H}
        role="img"
        tabIndex={0}
        aria-label={`${label}. Use the left and right arrow keys to read each point.`}
        className="block touch-pan-y"
        onPointerMove={(e) => at(e.clientX, e.currentTarget.getBoundingClientRect().left)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setHover((h) => Math.max(0, Math.min(points.length - 1, (h ?? points.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))));
        }}
      >
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-hairline)" />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-muted)">
              {format(v)}
            </text>
          </g>
        ))}
        {zeroLine && lo < 0 && hi > 0 && <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke="var(--color-hairline-strong)" />}
        {xTicks.map((i, k) => (
          <text key={i} x={x(ts[i])} y={H - 6} textAnchor={k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle'} fontSize="10" fill="var(--color-ink-muted)">
            {fmtMonth(points[i][0])}
          </text>
        ))}
        <polyline points={line} fill="none" stroke="var(--color-hue-blue-ink)" strokeWidth="2" strokeLinejoin="round" />
        <g>
          <line x1={x(ts[shown])} x2={x(ts[shown])} y1={pad.t} y2={H - pad.b} stroke="var(--color-hairline-strong)" strokeDasharray="3 3" />
          <circle cx={x(ts[shown])} cy={y(vs[shown])} r="4.5" fill="var(--color-hue-blue-ink)" stroke="var(--color-paper-raised)" strokeWidth="2" />
        </g>
      </svg>
      <details className="mt-2 text-xs text-ink-muted">
        <summary className="cursor-pointer font-semibold hover:text-ink">The same numbers as a table</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr className="border-b border-hairline text-xs">
                <th scope="col" className="py-1 pr-3 font-semibold">{weekly ? 'Week starting' : 'Month'}</th>
                <th scope="col" className="py-1 font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map(([d, v]) => (
                <tr key={d} className="border-b border-hairline/60">
                  <th scope="row" className="py-1 pr-3 font-normal tabular-nums">{d}</th>
                  <td className="py-1 tabular-nums text-ink">{format(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function FreightPanel() {
  const [data, setData] = useState<FreightResponse | null>(null);
  const [err, setErr] = useState(false);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    let live = true;
    getFreight()
      .then((d) => live && setData(d))
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, []);

  const withData = data?.chokepoints.filter((c) => c.points.length > 1) ?? [];
  const chosen = withData.find((c) => c.id === params.get('cp')) ?? withData[0];
  const gs = (data?.gscpi.points ?? []).filter(([d]) => d >= SINCE);

  return (
    <>
      <PulsePanel
        title="Global supply chain pressure"
        subtitle="New York Fed index, monthly. Zero is normal; above zero means more strain than usual."
        help="The Global Supply Chain Pressure Index combines shipping-cost measures (the Baltic Dry Index, the Harpex container-charter index and airfreight costs) with delivery-time, backlog and inventory readings from manufacturing surveys in seven major economies. It is measured in standard deviations from its average since 1997. Recent months can be revised."
      >
        {err && <p className="text-sm text-ink-faint">The index could not be loaded just now.</p>}
        {!err && !data && <p className="text-sm text-ink-faint">Loading…</p>}
        {data && gs.length < 2 && <p className="text-sm text-ink-faint">The index has not loaded into this site yet; it refreshes daily.</p>}
        {data && gs.length >= 2 && (
          <>
            <DateLine points={gs} format={(v) => v.toFixed(1)} label="Line chart of the New York Fed Global Supply Chain Pressure Index by month since 2019" readoutLabel="standard deviations from normal" zeroLine />
            <p className="mt-2 text-sm text-ink-muted">{data.note}</p>
            <ChartFooter
              source={data.gscpi.source}
              sourceUrl={data.gscpi.sourceUrl}
              asOf={data.gscpi.asOf ?? undefined}
              csv={{ filename: 'aex-terminal-gscpi.csv', header: ['month', 'gscpi_std_dev', 'source'], rows: data.gscpi.points.map(([d, v]) => [d.slice(0, 7), v, 'NY Fed GSCPI']) }}
            />
          </>
        )}
      </PulsePanel>

      <PulsePanel
        title="Ships through the world's chokepoints"
        subtitle="Vessels per day through each canal or strait, weekly average."
        help="IMF PortWatch estimates daily vessel transits from ship-tracking signals (AIS). A fall at the Suez Canal or Bab el-Mandeb with a rise at the Cape of Good Hope usually means ships are sailing around Africa. These are estimates, not customs figures, and ships that switch off their trackers are missed."
      >
        {err && <p className="text-sm text-ink-faint">Transit data could not be loaded just now.</p>}
        {data && !chosen && <p className="text-sm text-ink-faint">Transit data has not loaded into this site yet; it refreshes daily.</p>}
        {data && chosen && (
          <>
            <label className="mb-3 block text-sm text-ink-muted">
              Chokepoint
              <select
                value={chosen.id}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  next.set('cp', e.target.value);
                  setParams(next, { replace: true, preventScrollReset: true });
                }}
                className="ml-2 border border-hairline-strong bg-paper-raised px-2 py-1 text-sm text-ink"
              >
                {withData.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <DateLine
              key={chosen.id}
              points={chosen.points.filter(([d]) => d >= SINCE)}
              format={(v) => Math.round(v).toLocaleString('en-US')}
              label={`Line chart of weekly average daily vessel transits through the ${chosen.name} since 2019`}
              readoutLabel={`vessels a day, ${chosen.name}`}
              weekly
            />
            <ChartFooter
              source={data.chokepointSource}
              sourceUrl={data.chokepointSourceUrl}
              asOf={chosen.asOf ?? undefined}
              csv={{ filename: `aex-terminal-portwatch-${chosen.id}.csv`, header: ['week_starting', 'vessels_per_day', 'chokepoint', 'source'], rows: chosen.points.map(([d, v]) => [d, v, chosen.name, 'IMF PortWatch']) }}
            />
          </>
        )}
      </PulsePanel>
    </>
  );
}
