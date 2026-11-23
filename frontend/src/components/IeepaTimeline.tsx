import { useEffect } from 'react';
import { PulsePanel } from './PulsePanel';
import { IEEPA_EVENTS, IEEPA_REFUND_LINKS, IEEPA_STATUS_NOW, VERIFIED_ON, type IeepaStatus } from '../lib/ieepaTimeline';

// Status of the IEEPA ("reciprocal") tariffs. Every row is read from an official or primary page (CBP, the Supreme Court, the White House,
// the Court of International Trade); lib/ieepaTimeline.ts says what was left out because it could not be confirmed that way.

const TONE: Record<IeepaStatus, string> = {
  'in effect': 'text-stop',
  ended: 'text-ink-muted',
  court: 'text-ink',
  refunds: 'text-clear',
  replacement: 'text-review',
};
const LABEL: Record<IeepaStatus, string> = { 'in effect': 'In effect', ended: 'Ended', court: 'Court', refunds: 'Refunds', replacement: 'Replacement' };

export function IeepaTimeline() {
  // A link to /us-china#ieepa from another page opens the app without the browser's own jump to the anchor.
  useEffect(() => {
    if (window.location.hash === '#ieepa') document.getElementById('ieepa')?.scrollIntoView();
  }, []);
  return (
    <div id="ieepa">
      <PulsePanel
        title="IEEPA and 'reciprocal' tariffs: what happened"
        subtitle={`Status as of ${VERIFIED_ON}. Official and primary sources only.`}
        help="IEEPA is a 1977 emergency-powers law. In 2025 the President used it for the 'reciprocal' tariffs and for extra duties on China, Canada, Mexico, Brazil and India. The Supreme Court ruled in February 2026 that it does not allow tariffs. Section 232 and Section 301 tariffs are different laws and were not affected."
      >
        <div className="border border-hairline bg-paper px-4 py-3">
          <p className="text-sm font-semibold text-ink">{IEEPA_STATUS_NOW.headline}</p>
          <p className="mt-1 max-w-prose text-[13px] leading-snug text-ink-muted">{IEEPA_STATUS_NOW.body}</p>
        </div>
        <ol className="mt-4 divide-y divide-hairline border-y border-hairline">
          {IEEPA_EVENTS.map((e, i) => (
            <li key={`${e.date}-${i}`} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[7rem_1fr]">
              <p className="text-sm tabular-nums text-ink-muted">{e.date}</p>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{e.title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">Authority: {e.authority}</p>
                <p className="mt-0.5 text-[13px] leading-snug">
                  <span className={`font-semibold ${TONE[e.status]}`}>{LABEL[e.status]}.</span> <span className="text-ink-muted">{e.statusNow}</span>
                </p>
                {e.detail && <p className="mt-0.5 text-[13px] leading-snug text-ink-faint">{e.detail}</p>}
                <p className="mt-1 text-xs text-ink-faint">
                  Source:{' '}
                  <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {e.source}
                  </a>{' '}
                  (read {VERIFIED_ON})
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm font-semibold text-ink">Refund guidance</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-muted">
          {IEEPA_REFUND_LINKS.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-ink-faint">
          Not included because no official page could be read to confirm it: the lower-court rulings of 2025, the Court of International Trade's 2026 refund orders and any appeal of them, the court's
          later ruling on the Section 122 surcharge, and CBP's notice ending Section 122 collection. Refund eligibility depends on each entry; this is information, not legal advice.
        </p>
      </PulsePanel>
    </div>
  );
}
