import { useEffect, useState } from 'react';

// Larger text on request (user testing: most text on the policy pages is 12-13px, hard to read on an iPad). Much of the site sets sizes
// in pixels, so the whole page is scaled with CSS zoom rather than the root font size; the choice is remembered in this browser only.
const SIZES = [1, 1.15, 1.3] as const;
const LABELS = ['Normal text size', 'Large text', 'Largest text'];
const KEY = 'aex-text-size';

function apply(i: number) {
  document.documentElement.style.setProperty('--text-zoom', String(SIZES[i]));
  document.documentElement.toggleAttribute('data-text-zoom', i > 0);
}

export function TextSizeToggle() {
  const [i, setI] = useState(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      return v >= 0 && v < SIZES.length ? v : 0;
    } catch {
      return 0;
    }
  });
  useEffect(() => {
    apply(i);
    try {
      localStorage.setItem(KEY, String(i));
    } catch {
      /* storage unavailable: the size still applies for this visit */
    }
  }, [i]);
  const next = (i + 1) % SIZES.length;
  return (
    <button
      type="button"
      onClick={() => setI(next)}
      aria-label={`Text size: ${LABELS[i]}. Switch to ${LABELS[next].toLowerCase()}`}
      title={`Text size: ${LABELS[i]}`}
      className="flex h-8 shrink-0 items-center justify-center rounded-md px-1.5 text-ink-muted hover:text-ink pointer-coarse:h-11"
    >
      <span aria-hidden="true" className="font-semibold leading-none">
        <span className="text-[12px]">A</span>
        <span className={i > 0 ? 'text-[18px] text-ink' : 'text-[16px]'}>A</span>
      </span>
    </button>
  );
}
