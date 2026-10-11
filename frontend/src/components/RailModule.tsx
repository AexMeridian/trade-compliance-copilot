import type { ReactNode } from 'react';

// A small titled block for the right-hand rail of the front page: a heavy rule and a short title, then the
// content, with no box around it. The rail reads as a column of modules, not a stack of cards.
export function RailModule({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 border-t-2 border-ink pt-2">
        <h2 className="font-sans text-[14px] font-semibold tracking-normal text-ink">{title}</h2>
        {action && <div className="text-[12px]">{action}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
