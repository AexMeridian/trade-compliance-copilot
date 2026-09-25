import type { PulseAction } from '../types/pulse';
import { groupByTitle } from '../lib/pulseGrouping';
import { PulseActionDetails } from './PulseActionDetails';
import { DOC_TYPE_HINTS } from '../lib/pulseGlossary';
import { PulseTagChip } from './PulseTagChip';

function GroupMeta({ a }: { a: PulseAction }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-ink-faint">
      <span>{a.publication_date}</span>
      <span className="text-ink-muted" title={DOC_TYPE_HINTS[a.doc_type]}>
        {a.doc_type}
      </span>
      <span className="text-ink-muted">{a.agency}</span>
      <PulseTagChip tag={a.tag} />
    </div>
  );
}

export function PulseFeedList({ actions }: { actions: PulseAction[] }) {
  if (actions.length === 0) {
    return <p className="font-sans text-sm text-ink-faint">No actions in range yet -- try refreshing.</p>;
  }

  const groups = groupByTitle(actions);

  return (
    <ol className="flex flex-col gap-4">
      {groups.map((g) => {
        if (g.items.length === 1) {
          const a = g.items[0];
          return (
            <li key={a.document_number} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
              <GroupMeta a={a} />
              <a
                href={a.html_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block font-serif text-base leading-snug text-ink no-underline hover:text-accent"
              >
                {a.title}
              </a>
              {a.abstract && <p className="mt-1 line-clamp-2 font-sans text-sm text-ink-muted">{a.abstract}</p>}
              <PulseActionDetails a={a} />
            </li>
          );
        }

        const newest = g.items[0];
        const oldest = g.items[g.items.length - 1];
        return (
          <li key={g.title} className="border-b border-hairline pb-4 last:border-0 last:pb-0">
            <details>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-ink-faint">
                  <span>
                    {oldest.publication_date === newest.publication_date ? newest.publication_date : `${oldest.publication_date} – ${newest.publication_date}`}
                  </span>
                  <span className="text-ink-muted">{g.agency}</span>
                  <PulseTagChip tag={g.tag} />
                </div>
                <span className="mt-1.5 block font-serif text-base leading-snug text-ink hover:text-accent">
                  {g.title} <span className="font-sans text-sm text-ink-faint">&times;{g.items.length}</span>
                </span>
                <p className="mt-1 font-sans text-sm text-ink-faint">
                  {g.items.length} separate actions under this same notice type -- the Federal Register doesn't expose distinguishing
                  detail beyond the linked document itself. Tap to list each one.
                </p>
              </summary>
              <ol className="mt-3 flex flex-col gap-1.5 border-l border-hairline pl-3">
                {g.items.map((a) => (
                  <li key={a.document_number}>
                    <a
                      href={a.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex gap-3 font-mono text-xs text-ink-muted no-underline hover:text-accent"
                    >
                      <span>{a.publication_date}</span>
                      <span>{a.document_number}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
