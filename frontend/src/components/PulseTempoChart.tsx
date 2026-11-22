import type { TempoPoint } from '../types/pulse';
import { downloadCsv } from '../lib/downloadCsv';

// The year is shown on the first label and every January, so a long axis is never a row of bare month names.
function monthLabel(month: string, withYear: boolean): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  const short = date.toLocaleDateString('en-US', { month: 'short' });
  return withYear ? `${short} ${year.slice(2)}` : short;
}

// The month-count options this chart's range selector offers, and what each
// maps to for the backend's /tempo?months= param. "All" is a generous clamp
// (the route itself caps at 120) rather than a separate "no window" query --
// simpler, and the dataset isn't yet old enough for the difference to matter.
export const TEMPO_RANGES = [
  { id: '6mo', label: '6mo', months: 6 },
  { id: '1yr', label: '1yr', months: 12 },
  { id: '2yr', label: '2yr', months: 24 },
  { id: '5yr', label: '5yr', months: 60 },
  { id: 'all', label: 'All', months: 120 },
] as const;
export type TempoRangeId = (typeof TEMPO_RANGES)[number]['id'];

// trendPct comes from the same trailing-30-vs-prior-30-day comparison shown
// in the signal strip above (routes/pulse.ts's /summary), rather than
// diffing this chart's own monthly buckets -- the most recent bucket here
// is usually a partial, still-accumulating month, so comparing it to a
// full prior month would read as a manufactured decline every single time.
// One number, one source of truth, shown in both places.
//
// The range selector is opt-in via `range`/`onRangeChange`: a caller that
// doesn't pass them (there are none left, but keeping the props optional
// costs nothing) gets the chart with no selector, same as before this was
// added.
export function PulseTempoChart({
  months,
  trendPct,
  range,
  onRangeChange,
}: {
  months: TempoPoint[];
  trendPct: number | null;
  range?: TempoRangeId;
  onRangeChange?: (id: TempoRangeId) => void;
}) {
  if (months.length === 0) {
    return <p className="text-sm text-ink-faint">No U.S. actions naming this in the period shown.</p>;
  }
  const max = Math.max(...months.map((m) => m.count), 1);

  return (
    <div>
      {onRangeChange && (
        <div className="mb-3 flex gap-1">
          {TEMPO_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onRangeChange(r.id)}
              aria-pressed={range === r.id}
              className={`rounded px-2 py-1 text-xs font-semibold ${range === r.id ? 'bg-ink text-paper' : 'text-ink-muted hover:bg-hairline'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex h-32 min-w-0 gap-1">
        {months.map((m) => (
          <div
            key={m.month}
            tabIndex={0}
            role="img"
            aria-label={`${m.month}: ${m.count} actions`}
            title={`${m.month}: ${m.count} actions`}
            className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
          >
            <span className="mb-1 tabular-nums text-[10px] text-ink-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{m.count}</span>
            <div className="w-full bg-hue-orange/80 transition-colors group-hover:bg-hue-orange" style={{ height: `${Math.max((m.count / max) * 100, 3)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 border-t border-hairline pt-1.5">
        {months.map((m, i) => {
          const show = i % 3 === 0;
          const firstShown = i === 0;
          const january = m.month.endsWith('-01');
          return (
            <div key={m.month} className="flex-1 whitespace-nowrap text-center tabular-nums text-[10px] text-ink-faint">
              {show ? monthLabel(m.month, firstShown || january || months.slice(Math.max(0, i - 2), i).some((x) => x.month.endsWith('-01'))) : ''}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">
        {months[0].month} to {months[months.length - 1].month}. The latest month is still accumulating.{' '}
        <button
          type="button"
          onClick={() => downloadCsv('aex-terminal-policy-tempo.csv', ['month', 'actions', 'source'], months.map((m) => [m.month, m.count, 'Federal Register via Aex Terminal']))}
          className="font-semibold text-ink-muted underline hover:text-ink"
        >
          Download CSV
        </button>
      </p>
      {trendPct !== null && (
        <p className="mt-3 text-xs text-ink-muted">
          <span className={`tabular-nums ${trendPct > 0 ? 'text-clear' : trendPct < 0 ? 'text-stop' : ''}`}>
            {trendPct > 0 ? '▲' : trendPct < 0 ? '▼' : '—'}
          </span>{' '}
          Trailing 30 days {trendPct === 0 ? 'flat' : `${trendPct > 0 ? 'up' : 'down'} ${Math.abs(trendPct)}%`} vs. the 30 days before.
        </p>
      )}
    </div>
  );
}
