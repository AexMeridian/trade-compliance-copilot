import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

// The small "i" that keeps definitions and caveats one press away instead of printing them under every number. It is a disclosure button
// (not a hover-only tooltip), so it works with a keyboard, a screen reader and a touch screen; Escape or a click elsewhere closes it.
export function InfoPopover({ label, children, align = 'left' }: { label: string; children: ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-hairline-strong text-[12px] font-semibold leading-none text-ink-muted hover:border-ink hover:text-ink pointer-coarse:h-8 pointer-coarse:w-8"
      >
        i
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label={label}
          className={`absolute top-full z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-hairline-strong bg-paper-raised p-3 text-left text-[13px] font-normal leading-relaxed text-ink-muted shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      )}
    </span>
  );
}
