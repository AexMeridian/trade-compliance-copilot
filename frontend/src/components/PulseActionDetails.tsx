import type { PulseAction } from '../types/pulse';
import { CITATION_HINT } from '../lib/pulseGlossary';
import { plainSummary } from '../lib/pulsePlain';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Shared by PulseFeedList (singleton rows) and PulseTopSignals -- the one
// deadline/citation presentation this dashboard needs, written once. A plain
// sentence comes first for everyone; the exact citation and dates (Federal
// Register data, not model output) follow in small type for people who need
// them. comments_close_on only appears on documents that were actually open
// for comment (most Notices have none of these fields).
export function PulseActionDetails({ a }: { a: PulseAction }) {
  const commentOpen = a.comments_close_on !== null && a.comments_close_on >= todayIso();

  return (
    <>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{plainSummary(a)}</p>
      {(a.citation || a.comments_close_on || a.effective_on) && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 tabular-nums text-[11px] text-ink-faint">
          {a.citation && <span title={CITATION_HINT}>{a.citation}</span>}
          {a.comments_close_on && (
            <span
              className={commentOpen ? 'text-ink' : ''}
              title={commentOpen ? 'The public can still submit feedback on this before it becomes final.' : undefined}
            >
              {commentOpen ? 'Comments close' : 'Comments closed'} {a.comments_close_on}
            </span>
          )}
          {a.effective_on && <span>Effective {a.effective_on}</span>}
        </div>
      )}
    </>
  );
}
