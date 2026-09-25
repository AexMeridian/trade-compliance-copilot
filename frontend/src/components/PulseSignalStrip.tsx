import type { PulseSummary } from '../types/pulse';
import { PulseDelta } from './PulseDelta';
import { PulsePanel } from './PulsePanel';
import { SECTION_HUE, TAG_HUE } from '../lib/pulseColors';

export function PulseSignalStrip({ summary, activeMeasureCount }: { summary: PulseSummary; activeMeasureCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3 lg:grid-cols-5">
      <PulsePanel accent={SECTION_HUE.policy.bg} title="30-Day Activity" subtitle={summary.trendPct === null ? 'no prior-period baseline yet' : 'vs. the 30 days before'}>
        <div className="flex items-baseline font-mono text-2xl font-semibold text-ink">
          {summary.last30}
          <PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct ?? 0)}%`} className="ml-2 text-sm" />
        </div>
      </PulsePanel>
      <PulsePanel accent={(TAG_HUE[summary.leadingTag ?? ''] ?? TAG_HUE.Other).bg} title="Leading Category" subtitle={summary.leadingTagShare !== null ? `${summary.leadingTagShare}% of the last 30 days` : 'no activity in range'}>
        <div className="font-mono text-2xl font-semibold text-ink">{summary.leadingTag ?? '—'}</div>
      </PulsePanel>
      <PulsePanel accent={SECTION_HUE.markets.bg} title="Active Measures" subtitle={summary.newMeasures90d > 0 ? `${summary.newMeasures90d} new this quarter` : 'in force'}>
        <div className="font-mono text-2xl font-semibold text-ink">{activeMeasureCount}</div>
      </PulsePanel>
      <PulsePanel accent={SECTION_HUE.comment.bg} title="Open for Comment" subtitle="the public can still weigh in on these">
        <div className="font-mono text-2xl font-semibold text-ink">{summary.openForComment}</div>
      </PulsePanel>
      <PulsePanel accent="bg-cat-gray" title="Total Tracked" subtitle="since this feed started">
        <div className="font-mono text-2xl font-semibold text-ink">{summary.totalTracked.toLocaleString()}</div>
      </PulsePanel>
    </div>
  );
}
