import type { DutyStackLine } from '../types/case';
import { ProvenanceBadge } from './ProvenanceBadge';

// A customs attorney's first question about any HTS-sourced number is "as of
// which revision?" -- every line already carries its own effective_date
// (hts.revision, see src/lib/dutyStack.ts), but that was only ever shown
// per-row. The first line is always HTS-sourced (Column 1 General), so its
// effective_date doubles as a single top-of-table stamp without a schema
// change or a second backend field.
//
// Layout: the answer first (a total), then one row per duty layer with the
// rate on the right where the eye lands, the legal basis underneath in
// smaller type, and boilerplate notes folded away.
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
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border border-hairline-strong bg-paper px-4 py-3">
        <div>
          <p className="text-xs text-ink-faint">Total estimated duty</p>
          {totalPct !== null ? (
            <p className="font-display text-3xl font-bold tabular-nums text-ink">{totalPct}%</p>
          ) : (
            <p className="text-base font-semibold text-review">Can't be totalled automatically</p>
          )}
        </div>
        <div className="text-sm text-ink-muted sm:text-right">
          {declaredValueUsd != null && landedCostUsd != null && dutyUsd != null ? (
            <>
              <p className="tabular-nums">
                {usd(dutyUsd)} duty on {usd(declaredValueUsd)}
              </p>
              <p className="tabular-nums">{usd(landedCostUsd)} landed cost</p>
            </>
          ) : declaredValueUsd != null ? (
            <p>Dollar amount unavailable: a layer below has a rate this app can't sum.</p>
          ) : totalPct === null ? (
            <p>See the flagged layers below.</p>
          ) : null}
        </div>
      </div>

      <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
        {lines.map((line, i) => (
          <li key={i} className={`grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 ${line.applies ? '' : 'opacity-75'}`}>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${line.applies ? 'text-ink' : 'text-ink-muted'}`}>{line.layer}</p>
              <p className="mt-0.5 max-w-prose text-[13px] leading-snug text-ink-muted">{line.legal_basis}</p>
              {!line.applies && line.reason_if_not_applied && <p className="mt-1 max-w-prose text-[13px] italic leading-snug text-ink-faint">{line.reason_if_not_applied}</p>}
              {line.caveat && (
                <p className="mt-1.5 max-w-prose border-l-2 border-review bg-review-soft px-2 py-1 text-[13px] leading-snug text-ink">{line.caveat}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {line.source && <ProvenanceBadge source={line.source} />}
                <span className="text-xs tabular-nums text-ink-faint">Effective {line.effective_date}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-ink">
                {line.applies ? (line.rate_pct !== null ? `${line.rate_pct}%` : 'n/a') : '—'}
              </p>
              {!line.applies && <p className="text-xs text-ink-faint">not applied</p>}
              {line.applies && line.rate_pct === null && <p className="text-xs text-review">rate unavailable</p>}
            </div>
          </li>
        ))}
      </ul>

      {revision && <p className="mt-2 text-xs text-ink-faint">Checked against {revision}. HTS revisions change; re-run this case if it's been a while.</p>}
      {deMinimisNote && <p className="mt-2 max-w-prose text-xs leading-relaxed text-ink-faint">{deMinimisNote}</p>}
      {/* Gated on htsCode (only passed for a real case's own result, not the
          country page's loop of representative sample headings) so these
          notes appear once per real determination, not once per sample row. */}
      {htsCode && (
        <details className="mt-3 text-xs text-ink-muted">
          <summary className="cursor-pointer font-medium text-ink-muted hover:text-ink">About this estimate</summary>
          <div className="mt-2 max-w-prose space-y-2 leading-relaxed text-ink-faint">
            <p>
              Want a binding answer, not an estimate? CBP's ruling database (CROSS) is searchable at{' '}
              <a href="https://rulings.cbp.gov/" target="_blank" rel="noopener noreferrer" className="text-accent">
                rulings.cbp.gov
              </a>
              . Paste in <span className="tabular-nums text-ink">{htsCode}</span> or your product description to see whether CBP has ruled on something similar. CROSS
              has no bulk search API, so this is a link to search by hand, not an automatic lookup.
            </p>
            <p>
              Assumes a standard consumption entry. It does not account for a foreign-trade zone, bonded warehouse or duty-drawback program, each of which can
              defer, reduce or recover duty under its own eligibility rules. Ask a licensed customs broker whether any apply.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
