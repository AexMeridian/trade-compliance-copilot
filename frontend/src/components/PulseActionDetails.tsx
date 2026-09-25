import type { PulseAction } from '../types/pulse';
import { COUNTRY_LABELS, parseCountries } from '../lib/pulseCountries';
import { CITATION_HINT } from '../lib/pulseGlossary';

const todayIso = () => new Date().toISOString().slice(0, 10);

// Shared by PulseFeedList (singleton rows) and PulseTopSignals -- the one
// deadline/citation/country presentation this dashboard needs, written once.
// Federal Register data, not model output: citation and effective_on are
// almost always present; comments_close_on only appears on documents that
// were actually open for comment (most Notices have none of the three).
export function PulseActionDetails({ a }: { a: PulseAction }) {
  const countries = parseCountries(a.countries);
  const commentOpen = a.comments_close_on !== null && a.comments_close_on >= todayIso();

  return (
    <>
      {(a.citation || a.comments_close_on || a.effective_on) && (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-faint">
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
      {countries.length > 0 && (
        <p className="mt-1 font-sans text-[11px] text-ink-faint">{countries.map((c) => COUNTRY_LABELS[c] ?? c).join(', ')}</p>
      )}
    </>
  );
}
