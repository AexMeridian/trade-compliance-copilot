import type { Verdict } from '../types/case';
import { parseIssue, type ParsedIssue } from './IssueList';

const CONFIG: Record<Verdict, { label: string; bg: string; fg: string; border: string; note: string }> = {
  clear: {
    label: 'Clear',
    bg: 'bg-clear-soft',
    fg: 'text-clear',
    border: 'border-clear/40',
    note: 'No blocking findings across classification, origin, screening, or determination.',
  },
  review_required: {
    label: 'Review required',
    bg: 'bg-review-soft',
    fg: 'text-review',
    border: 'border-review/40',
    note: 'One or more findings need a human analyst before this transaction proceeds.',
  },
  stop: {
    label: 'Stop',
    bg: 'bg-stop-soft',
    fg: 'text-stop',
    border: 'border-stop/40',
    note: 'A blocking finding was identified (denied-party hit or license required). Do not proceed without compliance sign-off.',
  },
};

const SHOWN_ISSUES = 3;

export function VerdictBanner({
  verdict,
  caseId,
  generatedAt,
  issues = [],
  lead = [],
}: {
  verdict: Verdict;
  caseId: string;
  generatedAt?: string;
  issues?: string[];
  /** Findings that caused the verdict but aren't open issues (e.g. "License required"); listed first. */
  lead?: ParsedIssue[];
}) {
  const cfg = CONFIG[verdict];
  // Blocking findings first, then the determination, then everything else (stable).
  const rank = (s: string) => (/HARD STOP|license required|denied|blocked/i.test(s) ? 0 : s.startsWith('Determination') ? 1 : 2);
  const shown =
    verdict === 'clear'
      ? []
      : [...lead, ...[...issues].sort((a, b) => rank(a) - rank(b)).map(parseIssue)].slice(0, SHOWN_ISSUES);
  return (
    <div className={`border ${cfg.border} ${cfg.bg} px-5 py-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className={`display text-3xl ${cfg.fg}`}>{cfg.label}</h1>
        <span className="tabular-nums text-xs text-ink-muted">
          Case {caseId.slice(0, 8)}
          {generatedAt ? `, generated ${new Date(generatedAt).toLocaleString()}` : ''}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{cfg.note}</p>
      {shown.length > 0 && (
        <div className="mt-3 border-t border-current/20 pt-3">
          <p className="text-sm font-semibold text-ink">What needs attention</p>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {shown.map((s, i) => (
              <li key={i} className="flex flex-col sm:flex-row sm:gap-3">
                <span className="shrink-0 text-xs font-semibold text-ink-muted sm:w-28 sm:text-sm sm:font-medium">{s.group === 'Other' ? 'General' : s.group}</span>
                <span className="line-clamp-2 text-ink">{s.title ?? s.body}</span>
              </li>
            ))}
          </ul>
          {issues.length > 0 && (
            <a href="#open-issues" className="no-print mt-2 inline-block text-sm text-accent hover:underline">
              See all {issues.length} open issue{issues.length === 1 ? '' : 's'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
