import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPower, getTrends, type PowerIndicator, type TrendReading, type TrendsResponse } from '../lib/api';
import { ChartFooter } from './ChartFooter';
import { DriverScatter } from './DriverScatter';
import { InfoPopover } from './InfoPopover';
import { MOVER_COUNTRIES, MoversBoard } from './MoversBoard';
import { PewTrendPanel } from './PewTrendPanel';
import { SectionHeader } from './SectionHeader';
import { SUBJECT_COLOR, TrendChart } from './TrendChart';

const fmt = (unit: TrendReading['unit']) => (v: number) => (unit === 'percent' ? `${Number.isInteger(v) ? v : v.toFixed(1)}%` : unit === 'net' ? `${v > 0 ? '+' : ''}${v}` : v.toFixed(1));

// The latest change a reading shows for a country: the last published value against the one before it, with both years.
function lastChange(line: TrendReading['lines'][number]) {
  const p = [...line.points].sort((a, b) => a[0] - b[0]);
  if (p.length < 2) return null;
  const a = p[p.length - 2];
  const b = p[p.length - 1];
  return { from: a[0], to: b[0], delta: Math.round((b[1] - a[1]) * 10) / 10 };
}

function Delta({ d, unit, labels }: { d: ReturnType<typeof lastChange>; unit: TrendReading['unit']; labels?: Record<string, string> }) {
  if (!d) return <span className="text-ink-faint">one reading</span>;
  const up = d.delta > 0;
  const flat = d.delta === 0;
  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{flat ? '–' : up ? '▲' : '▼'}</span> <span className="font-semibold text-ink">{flat ? 'no change' : `${up ? 'Up' : 'Down'} ${Math.abs(d.delta)}${unit === 'percent' ? ' pts' : ''}`}</span>{' '}
      <span className="text-ink-muted">
        ({labels?.[d.from] ?? d.from} to {labels?.[d.to] ?? d.to})
      </span>
    </span>
  );
}

// A readable vertical range around the plotted values, never a range that hides which way a line moves. The axis labels always show it.
function domain(r: TrendReading) {
  const v = r.lines.flatMap((l) => l.points.map((p) => p[1]));
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const step = r.unit === 'net' ? 10 : 10;
  const min = Math.floor((lo - 4) / step) * step;
  const max = Math.ceil((hi + 4) / step) * step;
  return { min, max, ticks: [min, (min + max) / 2, max] };
}

function ReadingCard({ r, events }: { r: TrendReading; events: TrendsResponse['events'] }) {
  return (
    <article className="card min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-tight text-ink">{r.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{r.headline}</p>
        </div>
        <InfoPopover label={`About ${r.title}`} align="right">
          <p>{r.measure}</p>
          <p className="mt-2 font-semibold text-ink">What this does not tell you</p>
          <p>{r.caveat}</p>
          <p className="mt-2">{r.coverage}</p>
        </InfoPopover>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-muted">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${r.population === 'public' ? 'bg-soft-tint text-soft' : 'bg-hard-tint text-hard'}`}>{r.population === 'public' ? 'General public' : 'Experts and opinion leaders'}</span>
        <span>{r.publisher}</span>
      </p>
      <div className="mt-3">
        <TrendChart
          lines={r.lines.map((l) => ({ id: l.subject, label: l.label, color: SUBJECT_COLOR[l.subject] ?? 'var(--color-ink-muted)', points: l.points }))}
          format={fmt(r.unit)}
          events={events}
          min={domain(r).min}
          max={domain(r).max}
          ticks={domain(r).ticks}
          zeroLine={r.unit === 'net'}
          ariaLabel={`${r.title}: ${r.lines.map((l) => l.label).join(', ')}.`}
        />
      </div>
      {r.periodNote && <p className="mt-1 text-[12px] text-ink-faint">{r.periodNote}</p>}
      <ChartFooter
        source={r.publisher}
        sourceUrl={r.url}
        asOf={r.release}
        csv={{
          filename: `aex-terminal-${r.id}.csv`,
          header: ['Subject', 'Year', 'Value'],
          rows: r.lines.flatMap((l) => l.points.map((p) => [l.label, p[0], p[1]])),
        }}
      />
    </article>
  );
}

// The Soft Power scoreboard: how the U.S. and its rivals stand, who is rising and who is falling, and what sits alongside the movement.
// Every line is one publisher's own published figures; they are shown side by side and never combined.
export function ScoreboardTab({ onOpen }: { onOpen: (tab: 'attitudes' | 'method') => void }) {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [indicators, setIndicators] = useState<PowerIndicator[] | null>(null);

  useEffect(() => {
    let live = true;
    getTrends()
      .then((r) => live && setData(r))
      .catch(() => live && setFailed(true));
    getPower(MOVER_COUNTRIES)
      .then((r) => live && r.loaded && setIndicators(r.indicators))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <p className="text-sm text-ink-muted">Couldn't load the trend readings. Please try again in a moment.</p>;
  if (!data) return <p className="text-sm text-ink-faint">Loading…</p>;

  const events = data.events;
  const forStrip = data.readings
    .map((r) => ({ r, us: r.lines.find((l) => l.subject === 'US'), cn: r.lines.find((l) => l.subject === 'CN') }))
    .filter((x) => x.us && lastChange(x.us));

  return (
    <div className="flex flex-col gap-8">
      <SectionHeader
        tone="soft"
        title="Scoreboard: is U.S. soft power rising or falling?"
        description="Independent surveys, each shown on its own. Different pollsters ask different people different questions, so they are never averaged. Where they agree, it is worth noticing; where they differ, the table says why."
      />

      <section aria-labelledby="direction-h" className="min-w-0">
        <h3 id="direction-h" className="font-display text-xl font-bold text-ink">
          Direction of travel, reading by reading
        </h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">The latest published change for the U.S. and China in each reading, with the two years compared. A change is a move in points, not a verdict.</p>
        <div className="card mt-3 min-w-0">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Latest change in each published reading, United States and China</caption>
            <thead>
              <tr className="border-b border-hairline text-xs text-ink-muted">
                <th scope="col" className="px-3 py-2 font-semibold sm:px-4">Reading</th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  <span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SUBJECT_COLOR.US }} />
                  United States
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  <span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SUBJECT_COLOR.CN }} />
                  China
                </th>
              </tr>
            </thead>
            <tbody>
              {forStrip.map(({ r, us, cn }) => (
                <tr key={r.id} className="border-b border-hairline/60 last:border-0">
                  <th scope="row" className="px-4 py-2 font-normal text-ink">
                    {r.title}
                    <span className="block text-[11px] text-ink-faint">{r.publisher.split(',')[0]}</span>
                  </th>
                  <td className="px-2 py-2">
                    <Delta d={us ? lastChange(us) : null} unit={r.unit} labels={r.periodLabels} />
                  </td>
                  <td className="px-2 py-2">{cn ? <Delta d={lastChange(cn)} unit={r.unit} labels={r.periodLabels} /> : <span className="text-ink-faint">not published</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PewTrendPanel pew={data.pew} events={events} />

      <section aria-labelledby="readings-h" className="min-w-0">
        <h3 id="readings-h" className="font-display text-xl font-bold text-ink">
          More readings, from other publishers
        </h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          Each card is one publisher's own figures, credited and linked, with who was asked. Gaps are years the publisher did not state as numbers.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {data.readings.map((r) => (
            <ReadingCard key={r.id} r={r} events={events} />
          ))}
        </div>
      </section>

      <section aria-labelledby="why-h" className="min-w-0">
        <h3 id="why-h" className="font-display text-xl font-bold text-ink">
          Why: what sits alongside the movement
        </h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          These are things that happened or that people said, shown beside the lines. Dates and wording come from the named official sources. They are not claims that one caused the other.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="card min-w-0 p-4">
            <p className="text-[15px] font-semibold text-ink">Dated events</p>
            <ol className="mt-2 divide-y divide-hairline">
              {events.map((e) => (
                <li key={e.date} className="py-2 text-[13px]">
                  <p className="tabular-nums font-semibold text-ink">{new Date(`${e.date}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</p>
                  <p className="text-ink-muted">{e.label}</p>
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-[12px] text-ink-muted underline hover:text-ink">
                    {e.sourceName}
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink-faint">Only events with an official source we could open are listed. Other events that shaped opinion are not here because we could not source them.</p>
          </div>
          <DriverScatter drivers={data.pew.drivers} />
        </div>
      </section>

      {indicators && <MoversBoard indicators={indicators} />}

      <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Want the country-by-country survey results?{' '}
        <button type="button" onClick={() => onOpen('attitudes')} className="text-accent hover:underline">
          Open Attitudes
        </button>
        . For sources, licences and what is left out, see{' '}
        <button type="button" onClick={() => onOpen('method')} className="text-accent hover:underline">
          Method & gaps
        </button>{' '}
        and the{' '}
        <Link to="/methodology#sources" className="text-accent hover:underline">
          Methodology
        </Link>{' '}
        page.
      </p>
    </div>
  );
}
