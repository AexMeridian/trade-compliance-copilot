// Direction glyph + red/green, the one place this convention lives. Direction
// means up/down, not good/bad (the same as a price ticker), and reuses the
// app's existing --color-clear/--color-stop tokens rather than new hex values.
// `text` is the already-formatted magnitude (caller knows the unit: "19%",
// "0.03 pts", "$1.2B"); `change` only decides glyph and color.
export function PulseDelta({ change, text, className = '', onDark = false }: { change: number | null; text: string; className?: string; onDark?: boolean }) {
  if (change === null) return null;
  const up = change > 0;
  const down = change < 0;
  // The same up/down colors, lightened to stay readable on the black hero.
  const color = onDark ? (up ? 'text-[#4ade80]' : down ? 'text-[#fca5a5]' : 'text-white') : up ? 'text-clear' : down ? 'text-stop' : 'text-ink-muted';
  return (
    <span className={`tabular-nums ${color} ${className}`}>
      {up ? '▲' : down ? '▼' : '—'} {up || down ? text : 'flat'}
    </span>
  );
}
