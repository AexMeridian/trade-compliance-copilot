import type { ReactNode } from 'react';

// Shared tile shell for the terminal-style dashboard grid -- every panel on
// /pulse wraps in this instead of rendering its own <h2>/description. The
// outer grid container (Pulse.tsx) uses `gap-px bg-hairline` with every
// panel `bg-paper`, so the 1px gap reads as a shared hairline border
// between adjacent tiles -- no doubled borders, no new color, no radius or
// shadow (Pulse never uses either).
export function PulsePanel({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  // min-w-0 on both the root and the body is load-bearing, not decorative:
  // this panel sits inside CSS grid cells (Pulse.tsx), and a grid item's
  // default min-width is `auto`, meaning a wide-content child (e.g.
  // ActiveMeasuresTable's table) can force the whole column wider instead of
  // scrolling within it -- verified this actually happened (84px of real
  // page overflow at 1280px) before adding these.
  return (
    <div className={`flex h-full min-w-0 flex-col bg-paper ${className}`}>
      <div className="border-b border-hairline-strong bg-paper-raised px-3 py-1.5">
        <h2 className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">{title}</h2>
        {subtitle && <p className="mt-0.5 font-sans text-[11px] leading-snug text-ink-faint">{subtitle}</p>}
      </div>
      <div className="min-w-0 flex-1 p-3">{children}</div>
    </div>
  );
}
