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
// The yearly "Continuation of the National Emergency" renewals are presidential documents but routine: they extend an existing
// sanctions program and change nothing, so they must not outrank a new proclamation or rule as the lead story.
const ROUTINE_RENEWAL_RE = /^continuation of the national emergency/i;

// Document type alone put an import rule on Greek antiquities above a BIS semiconductor rule. Importance also depends on what the
// action does for people who trade: these adjustments are fixed word lists, applied the same way to every item, no model call.
// Routine paperwork and scheduling notices sink; actions that change duties, controls, sanctions or importer obligations rise.
const ROUTINE_RE =
  /agency information collection|paperwork reduction|sunshine act|meeting(s)? of|scheduling of|institution of (a )?five-year review|archaeological|ethnological|cultural property|privacy act|notice of (open|closed) meeting|request for nominations/i;
const IMPORTANT_RE =
  /tariff|duties|duty|section (232|301|338|201)|entity list|export (control|administration)|sanction|designation|de minimis|importer(s)? of record|forced labor|uflpa|withhold release|reciprocal|advanced (computing|semiconductor)|executive order|proclamation|exclusion(s)? (process|request)|general license/i;
function importance(a: PulseAction): number {
  const text = `${a.title} ${a.abstract ?? ''}`;
  if (ROUTINE_RENEWAL_RE.test(a.title)) return 1;
  let w = docTypeWeight(a.doc_type);
  if (ROUTINE_RE.test(a.title)) w -= 3;
  else if (IMPORTANT_RE.test(text)) w += 2;
  return w;
}
const weight = importance;

export function rankSignals(actions: PulseAction[], limit = 5): PulseAction[] {
  const standalone = groupByTitle(actions)
    .filter((g) => g.items.length === 1)
    .map((g) => g.items[0]);
  return standalone
    .sort((a, b) => weight(b) - weight(a) || b.publication_date.localeCompare(a.publication_date))
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
            className="mt-1.5 block font-serif text-[18px] font-semibold leading-snug text-ink no-underline hover:text-accent"
          >
            {a.title}
          </a>
          <PulseActionDetails a={a} />
        </li>
      ))}
    </ul>
  );
}
