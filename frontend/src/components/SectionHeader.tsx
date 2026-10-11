import type { ReactNode } from 'react';

// The one heading used to open every section on every page: a heavy rule, the title, a one-line description
// and, on the right, an optional action such as "All markets". Consistent section heads are most of what
// makes a front page read as organised.
export function SectionHeader({ title, description, action, level = 2 }: { title: string; description?: string; action?: ReactNode; level?: 2 | 3 }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <header className="border-t-2 border-ink pt-3">
      <div className="flex items-baseline justify-between gap-4">
        <Tag className="display text-[26px] leading-none text-ink">{title}</Tag>
        {action && <div className="shrink-0 text-[13px]">{action}</div>}
      </div>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">{description}</p>}
    </header>
  );
}
