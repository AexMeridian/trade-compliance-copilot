import type { Verdict } from '../types/case';

const CONFIG: Record<Verdict, { label: string; bg: string; fg: string; border: string; note: string }> = {
  clear: {
    label: 'Clear',
    bg: 'bg-clear-soft',
    fg: 'text-clear',
    border: 'border-clear',
    note: 'No blocking findings across classification, origin, screening, or determination.',
  },
  review_required: {
    label: 'Review required',
    bg: 'bg-review-soft',
    fg: 'text-review',
    border: 'border-review',
    note: 'One or more findings need a human analyst before this transaction proceeds.',
  },
  stop: {
    label: 'Stop',
    bg: 'bg-stop-soft',
    fg: 'text-stop',
    border: 'border-stop',
    note: 'A blocking finding was identified (denied-party hit or license required). Do not proceed without compliance sign-off.',
  },
};

export function VerdictBanner({ verdict, caseId, generatedAt }: { verdict: Verdict; caseId: string; generatedAt?: string }) {
  const cfg = CONFIG[verdict];
  return (
    <div className={`border-2 ${cfg.border} ${cfg.bg} px-5 py-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className={`font-serif text-2xl font-semibold ${cfg.fg}`}>{cfg.label}</h1>
        <span className="font-mono text-xs text-ink-muted">
          Case {caseId.slice(0, 8)}
          {generatedAt ? `, generated ${new Date(generatedAt).toLocaleString()}` : ''}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{cfg.note}</p>
    </div>
  );
}
