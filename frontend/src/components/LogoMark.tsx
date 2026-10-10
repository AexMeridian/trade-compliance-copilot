// The Aex Terminal mark: an A and an X sharing one foot, drawn with the thick-and-thin stroke contrast of
// engraved lettering. Colors come from `currentColor` so it follows the theme. `fine` is the full engraved
// version with a double hairline frame (large sizes); `bold` has heavier strokes and a single frame so it
// holds up at the size it appears in the header.
export function LogoMark({ variant = 'bold', className = '' }: { variant?: 'fine' | 'bold'; className?: string }) {
  const fine = variant === 'fine';
  const thick = fine ? 3.4 : 6.2;
  const thin = fine ? 1.1 : 2.8;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap={fine ? 'butt' : 'round'} strokeLinejoin={fine ? 'miter' : 'round'}>
      <rect x="6" y="6" width="88" height="88" strokeWidth={fine ? 0.7 : 2.4} />
      {fine && <rect x="10" y="10" width="80" height="80" strokeWidth={0.35} />}
      <path d="M15 78 L37 24" strokeWidth={thick} />
      <path d="M37 24 L59 78" strokeWidth={thin} />
      <path d="M21.5 62 H52.5" strokeWidth={thin} />
      <path d="M56 24 L86 78" strokeWidth={thick} />
      <path d="M86 24 L59 78" strokeWidth={thin} />
    </svg>
  );
}
