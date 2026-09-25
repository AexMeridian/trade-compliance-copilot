// Direction glyph + red/green, the one place this convention lives. Direction
// means up/down, not good/bad (the same as a price ticker), and reuses the
// app's existing --color-clear/--color-stop tokens rather than new hex values.
// `text` is the already-formatted magnitude (caller knows the unit: "19%",
// "0.03 pts", "$1.2B"); `change` only decides glyph and color.
export function PulseDelta({ change, text, className = '' }: { change: number | null; text: string; className?: string }) {
  if (change === null) return null;
  const up = change > 0;
  const down = change < 0;
  const color = up ? 'text-clear' : down ? 'text-stop' : 'text-ink-muted';
  return (
    <span className={`font-mono ${color} ${className}`}>
      {up ? '▲' : down ? '▼' : '—'} {up || down ? text : 'flat'}
    </span>
  );
}
