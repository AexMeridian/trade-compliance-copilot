import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type Tone = 'soft' | 'hard';

export const TONE = {
  soft: { text: 'text-soft', bar: 'bg-soft', tint: 'bg-soft-tint', ring: 'hover:border-soft', edge: 'before:bg-soft', css: 'var(--color-soft)' },
  hard: { text: 'text-hard', bar: 'bg-hard', tint: 'bg-hard-tint', ring: 'hover:border-hard', edge: 'before:bg-hard', css: 'var(--color-hard)' },
} as const;

// One headline reading: a big figure, what it is, a small picture of it (a sparkline or bars) and, if it leads somewhere, a way in. The
// whole tile is the control. The figure is always the real number, shown at once.
export function StatTile({
  tone,
  label,
  figure,
  note,
  visual,
  onClick,
  to,
}: {
  tone: Tone;
  label: string;
  figure: ReactNode;
  note?: ReactNode;
  visual?: ReactNode;
  onClick?: () => void;
  to?: string;
}) {
  const t = TONE[tone];
  const body = (
    <>
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} aria-hidden="true" />
      <span className="text-[13px] font-semibold text-ink-muted">{label}</span>
      <span className="display mt-2 block text-[34px] leading-none tabular-nums text-ink sm:text-[38px]">
        {figure}
      </span>
      {note && <span className="mt-2 block text-[13px] leading-snug text-ink-muted">{note}</span>}
      {visual && <span className="mt-3 block">{visual}</span>}
    </>
  );
  const cls = `card relative block min-w-0 overflow-hidden px-4 pb-4 pt-5 text-left no-underline transition-colors ${t.ring} ${onClick || to ? '' : 'pointer-events-none'}`;
  if (to)
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} w-full`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Two or more labelled horizontal bars sharing one scale, for the little picture inside a tile. */
export function MiniBars({ rows, tone }: { rows: { label: string; pct: number; text: string }[]; tone: Tone }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-2 text-[12px] text-ink-muted">
          <span className="w-[4.5rem] shrink-0 truncate">{r.label}</span>
          <span className="h-2 flex-1 rounded-full bg-hairline" aria-hidden="true">
            <span className={`block h-2 rounded-full ${i === 0 ? TONE[tone].bar : 'bg-ink-faint'}`} style={{ width: `${Math.max(2, Math.min(100, r.pct))}%` }} />
          </span>
          <span className="min-w-10 shrink-0 whitespace-nowrap text-right tabular-nums text-ink">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}
