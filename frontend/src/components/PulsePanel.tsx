import { useId, useState, type ReactNode } from 'react';

// Shared card for every block on Pulse: a title, an optional one-line
// description, and the content. `help` adds a "What's this?" link that opens a
// plain-language explanation in place. It is a real button (so it works on
// touch, where hover tooltips don't exist) and stays closed until asked.
//
// min-w-0 on the root and the body is load-bearing: panels sit in CSS grid
// cells, where a grid item's default min-width is `auto`, so a wide child (a
// table) would widen the whole column instead of scrolling inside it.
export function PulsePanel({
  title,
  subtitle,
  help,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  help?: string;
  className?: string;
  children: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();

  return (
    <section className={`card flex h-full min-w-0 flex-col ${className}`}>
      <header className="px-4 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold leading-snug text-ink">{title}</h2>
          {help && (
            <button
              type="button"
              onClick={() => setHelpOpen((o) => !o)}
              aria-expanded={helpOpen}
              aria-controls={helpId}
              className="shrink-0 text-xs text-ink-faint underline decoration-hairline-strong underline-offset-2 hover:text-accent"
            >
              {helpOpen ? 'Hide' : "What's this?"}
            </button>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink-faint">{subtitle}</p>}
        {help && helpOpen && (
          <p id={helpId} className="mt-3 bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
            {help}
          </p>
        )}
      </header>
      <div className="min-w-0 flex-1 px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}
