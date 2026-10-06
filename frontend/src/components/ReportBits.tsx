import type { ReactNode } from 'react';

export type Tone = 'clear' | 'review' | 'stop' | 'neutral';

const TONE: Record<Tone, string> = {
  clear: 'border-clear/50 bg-clear-soft text-clear',
  review: 'border-review/50 bg-review-soft text-review',
  stop: 'border-stop/50 bg-stop-soft text-stop',
  neutral: 'border-hairline-strong bg-paper-raised text-ink-muted',
};

export function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap border px-2.5 py-1 text-xs font-semibold ${TONE[tone]}`}>{children}</span>;
}

/** One report module: numbered title, status chip on the right, content below. */
export function ReportSection({
  n,
  title,
  chip,
  action,
  children,
}: {
  n?: number;
  title: string;
  chip?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 border border-hairline bg-paper-raised">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline px-4 py-3 sm:px-5">
        <h2 className="font-display text-lg font-bold text-ink">
          {n !== undefined && <span className="mr-2 tabular-nums text-ink-faint">{n}</span>}
          {title}
        </h2>
        <div className="flex items-center gap-3">
          {action}
          {chip}
        </div>
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

/** Label/value pairs: the facts a reviewer looks for, without prose. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  const shown = items.filter((i) => i.value !== null && i.value !== undefined && i.value !== '');
  if (shown.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {shown.map((i) => (
        <div key={i.label}>
          <dt className="text-xs text-ink-faint">{i.label}</dt>
          <dd className="mt-0.5 text-sm text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
