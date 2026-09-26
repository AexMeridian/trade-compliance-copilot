import type { CurrencyRow } from '../types/pulse';
import { PulseDelta } from './PulseDelta';
import { PulseSpark } from './PulseCharts';

function formatRate(rate: number): string {
  const digits = rate < 10 ? 4 : rate < 1000 ? 2 : 1;
  return rate.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// ECB reference rates (one fixing per business day), so "as of" is a date,
// not a timestamp -- this is deliberately not presented as a live quote.
export function PulseCurrencies({ rows }: { rows: CurrencyRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-faint">Currency rates aren't available right now.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.quote} className="flex items-center gap-2 tabular-nums text-xs">
          <span className="w-16 shrink-0 text-ink-muted">{r.label}</span>
          <span className="w-16 shrink-0 text-right text-ink">{formatRate(r.rate)}</span>
          <div className="min-w-0 flex-1">
            <PulseSpark values={r.spark} height={20} />
          </div>
          <PulseDelta change={r.change30dPct} text={`${Math.abs(r.change30dPct ?? 0).toFixed(2)}%`} className="w-20 shrink-0 text-right" />
        </li>
      ))}
    </ul>
  );
}
