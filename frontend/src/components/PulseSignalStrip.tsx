import type { PulseSummary } from '../types/pulse';
import { PulseDelta } from './PulseDelta';

interface Stat {
  label: string;
  value: React.ReactNode;
  note: string;
  help: string;
}

// The key counts for the policy tab, as one card of figures rather than five
// separate panels. `help` is the plain-language definition, shown as a
// tooltip on the label.
export function PulseSignalStrip({ summary, activeMeasureCount }: { summary: PulseSummary; activeMeasureCount: number }) {
  const stats: Stat[] = [
    {
      label: 'Actions in 30 days',
      value: (
        <>
          {summary.last30}
          <PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct ?? 0)}%`} className="ml-2 text-sm font-medium" />
        </>
      ),
      note: summary.trendPct === null ? 'No earlier period to compare yet' : 'Compared with the 30 days before',
      help: 'New tariff, sanctions and export-control actions published by the U.S. government in the last 30 days. A rising number means the government is acting more often.',
    },
    {
      label: 'Most common type',
      value: summary.leadingTag ?? '-',
      note: summary.leadingTagShare !== null ? `${summary.leadingTagShare}% of the last 30 days` : 'No activity in range',
      help: 'The type of action that was most common in the last 30 days, and its share of all actions.',
    },
    {
      label: 'Active measures',
      value: activeMeasureCount,
      note: summary.newMeasures90d > 0 ? `${summary.newMeasures90d} new this quarter` : 'In force now',
      help: 'Extra import taxes currently in force under specific U.S. laws (Section 232, 301 and 338). This counts separate measures, not products.',
    },
    {
      label: 'Open for comment',
      value: summary.openForComment,
      note: 'Proposed rules the public can still comment on',
      help: 'Proposed rules that are not final yet. Anyone can send the government feedback before the deadline.',
    },
    {
      label: 'Total tracked',
      value: summary.totalTracked.toLocaleString(),
      note: 'Since this feed started',
      help: 'Every trade-related action collected since this page started keeping records.',
    },
  ];

  return (
    <dl className="card grid grid-cols-2 divide-hairline sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 border-b border-hairline p-4 last:border-b-0 lg:border-b-0">
          <dt className="text-[13px] text-ink-muted" title={s.help}>
            {s.label}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
          <dd className="mt-1 text-xs leading-snug text-ink-faint">{s.note}</dd>
        </div>
      ))}
    </dl>
  );
}
