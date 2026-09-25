import { AGENCY_HINTS } from '../lib/pulseGlossary';

const AGENCY_LABEL: Record<string, string> = {
  'International Trade Administration': 'Commerce / ITA',
  'International Trade Commission': "Int'l Trade Commission",
  'Foreign Assets Control Office': 'Treasury / OFAC',
  'Industry and Security Bureau': 'Commerce / BIS',
  'Customs and Border Protection': 'DHS / CBP',
  'Trade Representative': 'USTR',
  'State Department': 'State Dept.',
};

export function PulseAgencyBreakdown({ breakdown }: { breakdown: { agency: string; count: number }[] }) {
  if (breakdown.length === 0) {
    return <p className="font-sans text-sm text-ink-faint">No activity in the last 30 days.</p>;
  }
  const max = Math.max(...breakdown.map((b) => b.count), 1);

  return (
    <ul className="flex flex-col gap-2">
      {breakdown.map((b) => (
        <li key={b.agency} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate font-sans text-xs text-ink-muted" title={AGENCY_HINTS[b.agency]}>
            {AGENCY_LABEL[b.agency] ?? b.agency}
          </span>
          <span className="h-3 flex-1 bg-hairline">
            <span className="block h-full bg-cat-blue" style={{ width: `${Math.max((b.count / max) * 100, 4)}%` }} />
          </span>
          <span className="w-8 shrink-0 text-right font-mono text-xs text-ink">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}
