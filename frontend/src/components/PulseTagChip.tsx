import { TAG_HINTS } from '../lib/pulseGlossary';
import { TAG_HUE } from '../lib/pulseColors';

// The topic label used everywhere a U.S. action is listed: a colored dot for the
// topic (the same colors as the Customize panel and the guide) and its name.
export function PulseTagChip({ tag }: { tag: string }) {
  const hue = TAG_HUE[tag] ?? TAG_HUE.Other;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-muted ring-1 ring-inset ring-hairline"
      title={TAG_HINTS[tag]}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${hue.bg}`} aria-hidden="true" />
      {tag}
    </span>
  );
}
