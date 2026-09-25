import type { PulseAction } from '../types/pulse';
import { groupByTitle, docTypeWeight } from '../lib/pulseGrouping';
import { PulseActionDetails } from './PulseActionDetails';
import { DOC_TYPE_HINTS, TAG_HINTS } from '../lib/pulseGlossary';

// Ranking, not filtering by relevance in any semantic sense: standalone
// actions (not part of a routine batch -- see PulseFeedList's grouping)
// ordered by document type (a Presidential proclamation or final Rule
// outranks a routine administrative Notice) and then recency. Plain
// TypeScript sort, no model call -- see lib/pulseGrouping.ts.
function rankSignals(actions: PulseAction[]): PulseAction[] {
  const standalone = groupByTitle(actions)
    .filter((g) => g.items.length === 1)
    .map((g) => g.items[0]);
  return standalone
    .sort((a, b) => docTypeWeight(b.doc_type) - docTypeWeight(a.doc_type) || b.publication_date.localeCompare(a.publication_date))
    .slice(0, 5);
}

export function PulseTopSignals({ actions }: { actions: PulseAction[] }) {
  const ranked = rankSignals(actions);

  if (ranked.length === 0) {
    return <p className="font-sans text-sm text-ink-faint">Nothing distinct enough to rank yet -- try refreshing.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {ranked.map((a, i) => (
        <li key={a.document_number} className="flex gap-3">
          <span className="pt-0.5 font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-ink-faint">
              <span>{a.publication_date}</span>
              <span className="text-ink-muted" title={DOC_TYPE_HINTS[a.doc_type]}>
                {a.doc_type}
              </span>
              <span className="border border-hairline-strong px-1.5 py-0.5 font-sans text-[11px] text-ink-muted" title={TAG_HINTS[a.tag]}>
                {a.tag}
              </span>
            </div>
            <a
              href={a.html_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block font-serif text-sm leading-snug text-ink no-underline hover:text-accent"
            >
              {a.title}
            </a>
            <PulseActionDetails a={a} />
          </div>
        </li>
      ))}
    </ol>
  );
}
