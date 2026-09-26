import type { PulseAction } from '../types/pulse';
import { groupByTitle, docTypeWeight } from '../lib/pulseGrouping';
import { PulseActionDetails } from './PulseActionDetails';
import { DOC_TYPE_HINTS } from '../lib/pulseGlossary';
import { PulseTagChip } from './PulseTagChip';
import { friendlyDate } from '../lib/pulsePlain';

// Ranking, not filtering by relevance in any semantic sense: standalone
// actions (not part of a routine batch -- see PulseFeedList's grouping)
// ordered by document type (a Presidential proclamation or final Rule
// outranks a routine administrative Notice) and then recency. Plain
// TypeScript sort, no model call -- see lib/pulseGrouping.ts.
export function rankSignals(actions: PulseAction[], limit = 5): PulseAction[] {
  const standalone = groupByTitle(actions)
    .filter((g) => g.items.length === 1)
    .map((g) => g.items[0]);
  return standalone
    .sort((a, b) => docTypeWeight(b.doc_type) - docTypeWeight(a.doc_type) || b.publication_date.localeCompare(a.publication_date))
    .slice(0, limit);
}

export function PulseTopSignals({ actions, limit = 5, skip, emptyText }: { actions: PulseAction[]; limit?: number; skip?: string; emptyText?: string }) {
  // skip: an item already shown elsewhere on the page (the hero card).
  const ranked = rankSignals(actions, limit + (skip ? 1 : 0))
    .filter((a) => a.document_number !== skip)
    .slice(0, limit);

  if (ranked.length === 0) {
    return <p className="text-sm text-ink-faint">{emptyText ?? 'Nothing distinct enough to rank yet. Try refreshing.'}</p>;
  }

  return (
    <ul className="divide-y divide-hairline">
      {ranked.map((a) => (
        <li key={a.document_number} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
            <span>{friendlyDate(a.publication_date)}</span>
            <span title={DOC_TYPE_HINTS[a.doc_type]}>{a.doc_type}</span>
            <PulseTagChip tag={a.tag} />
          </div>
          <a
            href={a.html_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block text-[15px] font-medium leading-snug text-ink no-underline hover:text-accent"
          >
            {a.title}
          </a>
          <PulseActionDetails a={a} />
        </li>
      ))}
    </ul>
  );
}
