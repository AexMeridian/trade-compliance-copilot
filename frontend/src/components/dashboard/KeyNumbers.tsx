import type { DashKeyNumber } from '../../lib/api';
import { Spark, shortDate } from './Panel';

// The strip across the top: the dozen numbers that say how things are right now. Tapping one jumps to the panel behind it.
export function KeyNumbers({ items, onOpen }: { items: DashKeyNumber[]; onOpen: (k: DashKeyNumber) => void }) {
  if (!items.length) return null;
  return (
    <section aria-label="Key numbers">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((k) => (
          <li key={k.id}>
            <button type="button" onClick={() => onOpen(k)} className="card flex h-full w-full min-w-0 flex-col gap-1 p-3 text-left hover:border-accent">
              <span className="text-xs leading-tight text-ink-muted">{k.label}</span>
              <span className="display text-2xl leading-none tabular-nums text-ink">{k.value}</span>
              <span className="flex min-h-[28px] items-end justify-between gap-2">
                <span className="text-[11px] leading-tight text-ink-muted">
                  {k.direction === 'up' ? <span aria-hidden="true">▲ </span> : k.direction === 'down' ? <span aria-hidden="true">▼ </span> : null}
                  {k.change ?? (k.asOf ? `as of ${shortDate(k.asOf)}` : '')}
                </span>
                <Spark points={k.points} width={56} height={22} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
