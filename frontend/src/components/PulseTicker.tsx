import { useLayoutEffect, useRef, useState } from 'react';
import type { PulseAction } from '../types/pulse';
import { groupByTitle } from '../lib/pulseGrouping';

const MAX_ITEMS = 18;

// Constant scroll speed in px/s. A fixed animation duration makes speed
// depend on how much text the ticker happens to hold (the track is tens of
// thousands of px wide), which is how it kept reading as too fast after
// the duration was raised twice -- duration is now derived from the
// measured width instead.
const SPEED_PX_PER_SECOND = 40;

// Zero new fetches -- built from data the page already has in memory
// (the same `recentAll` sample PulseTopSignals ranks from), run through
// the same groupByTitle() the main feed uses so a 181-deep routine notice
// type collapses to one ticker item instead of scrolling past 180 identical
// headlines. This is a rotating *display* of already-synced real data, not
// a live stream -- the pinned "LATEST -- as of ..." chip says exactly how
// fresh that data is, right next to the moving content, not buried in a
// header line the user has to go cross-reference.
function tickerItems(actions: PulseAction[]) {
  return groupByTitle(actions)
    .slice(0, MAX_ITEMS)
    .map((g) => ({ ...g.items[0], title: g.items.length > 1 ? `${g.items[0].title} ×${g.items.length}` : g.items[0].title }));
}

export function PulseTicker({ actions, lastSynced }: { actions: PulseAction[]; lastSynced: string | null }) {
  const items = tickerItems(actions);
  const firstCopyRef = useRef<HTMLDivElement>(null);
  const [durationS, setDurationS] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (firstCopyRef.current) setDurationS(firstCopyRef.current.offsetWidth / SPEED_PX_PER_SECOND);
  }, [actions]);

  if (items.length === 0) return null;

  const track = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((a) => (
        <a
          key={a.document_number}
          href={a.html_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 whitespace-nowrap font-mono text-xs text-ink-muted no-underline hover:text-accent"
        >
          <span className="text-ink-faint">{a.tag}</span>
          <span className="text-ink">{a.title}</span>
          <span className="text-ink-faint">{a.agency}</span>
        </a>
      ))}
    </div>
  );

  return (
    <div role="region" aria-label="Latest activity" className="border-b border-hairline bg-paper-raised">
      <div className="mx-auto flex max-w-5xl items-center">
        <span className="shrink-0 border-r border-hairline-strong px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
          Latest{lastSynced ? ` — as of ${new Date(lastSynced).toLocaleTimeString()}` : ''}
        </span>
        <div className="pulse-ticker-viewport min-w-0 flex-1 overflow-hidden py-2">
          <div className="pulse-ticker-track flex w-max" style={durationS ? { animationDuration: `${durationS}s` } : undefined}>
            <div ref={firstCopyRef} className="flex shrink-0">
              {track}
            </div>
            <div aria-hidden="true" className="flex shrink-0">
              {track}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
