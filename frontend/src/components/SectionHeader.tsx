import type { ReactNode } from 'react';
import { TONE, type Tone } from './StatTile';

// The one heading used to open every section on every page: the title, a one-line description and, on the right, an optional action such
// as "All markets". Consistent section heads are most of what makes a front page read as organised. With a `tone` (the two power pages) it
// sits on a faint tinted band with a colored edge, so a tab reads as part of its page; without one it keeps the plain heavy rule.
export function SectionHeader({
  title,
  description,
  action,
  level = 2,
  tone,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  level?: 2 | 3;
  tone?: Tone;
}) {
  const Tag = level === 2 ? 'h2' : 'h3';
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <Tag className="display text-[26px] leading-none text-ink">{title}</Tag>
        {action && <div className="shrink-0 text-[13px]">{action}</div>}
      </div>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-muted">{description}</p>}
    </>
  );
  if (tone) {
    const t = TONE[tone];
    return <header className={`relative rounded-lg ${t.tint} py-4 pl-5 pr-4 before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:rounded-l-lg ${t.edge}`}>{inner}</header>;
  }
  return <header className="border-t-2 border-ink pt-3">{inner}</header>;
}
