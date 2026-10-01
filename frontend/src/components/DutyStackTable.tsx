import type { DutyStackLine } from '../types/case';
import { ProvenanceBadge } from './ProvenanceBadge';

// A customs attorney's first question about any HTS-sourced number is "as of
// which revision?" -- every line already carries its own effective_date
// (hts.revision, see src/lib/dutyStack.ts), but that was only ever shown
// per-row. The first line is always HTS-sourced (Column 1 General), so its
// effective_date doubles as a single top-of-table stamp without a schema
// change or a second backend field.
export function DutyStackTable({
  lines,
  totalPct,
  htsCode,
  declaredValueUsd,
  landedCostUsd,
  deMinimisNote,
}: {
  lines: DutyStackLine[];
  totalPct: number | null;
  htsCode?: string | null;
  declaredValueUsd?: number | null;
  landedCostUsd?: number | null;
  deMinimisNote?: string | null;
}) {
  const revision = lines[0]?.effective_date ?? null;
  const dutyUsd = declaredValueUsd != null && landedCostUsd != null ? Math.round((landedCostUsd - declaredValueUsd) * 100) / 100 : null;
  const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return (
    <div>
      {revision && <p className="mb-2 text-xs text-ink-faint">Checked against {revision}. HTS revisions change; re-run this case if it's been a while.</p>}
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
        {declaredValueUsd != null && (
          <tr>
            <td className="pt-1 text-xs text-ink-faint" colSpan={1}>
              On a declared value of {usd(declaredValueUsd)}
            </td>
            <td className="pt-1 tabular-nums text-xs text-ink-faint" colSpan={3}>
              {landedCostUsd != null && dutyUsd != null
                ? `${usd(dutyUsd)} duty, ${usd(landedCostUsd)} total landed cost`
                : 'Duty dollar amount unavailable -- one or more lines above have a rate this app cannot sum automatically.'}
            </td>
          </tr>
        )}
      </tfoot>
      </table>
      {deMinimisNote && <p className="mt-3 text-xs text-ink-faint">{deMinimisNote}</p>}
      {/* Gated on htsCode (only passed for a real case's own result, not the
          country page's loop of representative sample headings) so these two
          notes appear once per real determination, not once per sample row. */}
      {htsCode && (
        <>
          <p className="mt-3 text-xs text-ink-faint">
            Want a binding answer, not an estimate? CBP's own ruling database (CROSS) is searchable at{' '}
            <a href="https://rulings.cbp.gov/" target="_blank" rel="noopener noreferrer" className="text-accent">
              rulings.cbp.gov
            </a>{' '}
            -- paste in <span className="tabular-nums text-ink">{htsCode}</span> or your product description to see if CBP has already ruled on something
            similar. (CROSS has no bulk search API, so this is a link to search by hand, not an automatic lookup.)
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            This estimate assumes a standard consumption entry. It does not account for a foreign-trade zone, bonded warehouse, or duty-drawback program,
            each of which can defer, reduce or recover duty under its own separate eligibility rules this app does not evaluate -- ask a licensed customs
            broker whether any of them apply to this shipment.
          </p>
        </>
      )}
    </div>
  );
}
