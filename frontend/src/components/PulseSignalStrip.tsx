import type { PulseSummary } from '../types/pulse';
import { PulsePanel } from './PulsePanel';

// Direction is carried by glyph + position (same slot a stock ticker uses
// for "price / change") AND color, the same red/green convention a trading
// terminal uses for a directional delta -- up/down here, not good/bad, so
// this reuses --color-clear/--color-stop (already the app's only green/red
// tokens, defined for case-verdict severity) rather than inventing new hex
// values just for Pulse.
function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const glyph = pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
  const colorClass = pct > 0 ? 'text-clear' : pct < 0 ? 'text-stop' : 'text-ink-muted';
  return (
    <span className={`ml-2 font-mono text-sm ${colorClass}`}>
      {glyph} {pct !== 0 ? `${Math.abs(pct)}%` : 'flat'}
    </span>
  );
}

export function PulseSignalStrip({ summary, activeMeasureCount }: { summary: PulseSummary; activeMeasureCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3 lg:grid-cols-5">
      <PulsePanel title="30-Day Activity" subtitle={summary.trendPct === null ? 'no prior-period baseline yet' : 'vs. the 30 days before'}>
        <div className="flex items-baseline font-mono text-2xl font-semibold text-ink">
          {summary.last30}
          <Delta pct={summary.trendPct} />
        </div>
      </PulsePanel>
      <PulsePanel title="Leading Category" subtitle={summary.leadingTagShare !== null ? `${summary.leadingTagShare}% of the last 30 days` : 'no activity in range'}>
        <div className="font-mono text-2xl font-semibold text-ink">{summary.leadingTag ?? '—'}</div>
      </PulsePanel>
      <PulsePanel title="Active Measures" subtitle={summary.newMeasures90d > 0 ? `${summary.newMeasures90d} new this quarter` : 'in force'}>
        <div className="font-mono text-2xl font-semibold text-ink">{activeMeasureCount}</div>
      </PulsePanel>
      <PulsePanel title="Open for Comment" subtitle="the public can still weigh in on these">
        <div className="font-mono text-2xl font-semibold text-ink">{summary.openForComment}</div>
      </PulsePanel>
      <PulsePanel title="Total Tracked" subtitle="since this feed started">
        <div className="font-mono text-2xl font-semibold text-ink">{summary.totalTracked.toLocaleString()}</div>
      </PulsePanel>
    </div>
  );
}
