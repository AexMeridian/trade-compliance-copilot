import { useState } from 'react';
import { getPulseRelated } from '../lib/api';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { KIND_LABEL, TopicPill } from './ConnectionsPanel';
import type { RelatedLinkItem } from '../types/pulse';

// "Related" under a news item or policy action: other items that name the
// same country, share a topic, and fall within two weeks -- each with the
// reason it was linked. Collapsed by default so lists stay scannable, and
// fetched only when opened. Rendered only for items that name 1-3 countries
// (a roundup naming many is not about any one of them, so it has no links).
export function RelatedLinks({ kind, id, countries }: { kind: 'action' | 'news'; id: string; countries: string[] }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<RelatedLinkItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  if (countries.length === 0 || countries.length > 3) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && links === null && !failed) {
      const names = Object.fromEntries(countries.map((c) => [c, COUNTRY_LABELS[c] ?? c]));
      getPulseRelated(kind, id, names)
        .then((r) => setLinks(r.links))
        .catch(() => setFailed(true));
    }
  };

  return (
    <div className="mt-1.5">
      <button type="button" onClick={toggle} aria-expanded={open} className="text-xs font-medium text-accent hover:underline">
        {open ? 'Hide related' : 'Related'}
      </button>
      {open && (
        <div className="mt-1.5 border-l-2 border-hairline-strong pl-3">
          {failed ? (
            <p className="text-xs text-ink-faint">Couldn't load related items.</p>
          ) : links === null ? (
            <p className="text-xs text-ink-faint">Looking…</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-ink-faint">Nothing else in the last two weeks names the same country on the same topic.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={`${l.event.kind}:${l.event.id}`}>
                  <p className="text-[11px] text-ink-faint">
                    {KIND_LABEL[l.event.kind]} · {l.event.date}
                  </p>
                  {l.event.url ? (
                    <a href={l.event.url} target="_blank" rel="noreferrer" className="block text-[13px] leading-snug text-ink no-underline hover:text-accent">
                      {l.event.title}
                    </a>
                  ) : (
                    <p className="text-[13px] leading-snug text-ink">{l.event.title}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-ink-faint">{l.reason}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.sharedTopics.map((t) => (
                      <TopicPill key={t}>{t}</TopicPill>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
