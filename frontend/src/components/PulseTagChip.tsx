import { TAG_HINTS } from '../lib/pulseGlossary';
import { TAG_HUE } from '../lib/pulseColors';

// The tag badge used everywhere a U.S. action is listed: a colored square
// plus the name, so a scan down the feed shows tariffs vs. sanctions vs.
// export controls at a glance.
export function PulseTagChip({ tag }: { tag: string }) {
  const hue = TAG_HUE[tag] ?? TAG_HUE.Other;
  return (
    <span
      className="inline-flex items-center gap-1.5 border border-hairline-strong px-1.5 py-0.5 font-sans text-[11px] text-ink-muted"
      title={TAG_HINTS[tag]}
    >
      <span className={`h-2 w-2 ${hue.bg}`} aria-hidden="true" />
      {tag}
    </span>
  );
}
