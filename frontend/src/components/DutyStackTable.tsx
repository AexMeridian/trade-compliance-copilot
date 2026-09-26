import type { DutyStackLine } from '../types/case';
import { ProvenanceBadge } from './ProvenanceBadge';

export function DutyStackTable({ lines, totalPct }: { lines: DutyStackLine[]; totalPct: number | null }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-hairline-strong text-left text-ink-muted">
          <th className="py-1.5 pr-3 font-normal">Duty layer</th>
          <th className="py-1.5 pr-3 font-normal">Rate</th>
          <th className="py-1.5 pr-3 font-normal">Legal basis</th>
          <th className="py-1.5 font-normal">Effective</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, i) => (
          <tr key={i} className={`border-b border-hairline ${line.applies ? '' : 'text-ink-faint'}`}>
            <td className="py-2 pr-3 align-top">{line.layer}</td>
            <td className="py-2 pr-3 align-top tabular-nums">{line.applies ? (line.rate_pct !== null ? `${line.rate_pct}%` : 'not available') : '—'}</td>
            <td className="py-2 pr-3 align-top">
              <div>{line.legal_basis}</div>
              {!line.applies && line.reason_if_not_applied && <div className="mt-0.5 text-xs italic text-ink-faint">{line.reason_if_not_applied}</div>}
              {line.caveat && <div className="mt-0.5 text-xs text-review">{line.caveat}</div>}
              {line.source && (
                <div className="mt-1">
                  <ProvenanceBadge source={line.source} />
                </div>
              )}
            </td>
            <td className="py-2 align-top tabular-nums">{line.effective_date}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td className="pt-3 font-semibold" colSpan={1}>
            Total estimated landed-cost duty
          </td>
          <td className="pt-3 tabular-nums font-semibold" colSpan={3}>
            {totalPct !== null ? `${totalPct}%` : 'Total unavailable, see the flagged lines above'}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
