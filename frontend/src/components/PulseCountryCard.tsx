import { useEffect, useRef } from 'react';
import type { NewsItem, PulseAction } from '../types/pulse';
import { COUNTRY_LABELS, parseCountries } from '../lib/pulseCountries';
import { NEWS_HUE, TAG_HUE } from '../lib/pulseColors';
import { friendlyDate } from '../lib/pulsePlain';
import { timeAgo } from './PulseNews';

// What the globe shows after a country is pressed: this month's count, the
// newest U.S. actions and headlines that name it, and a way into the full list.
// Everything is read from data the page already has (no extra request).
export function PulseCountryCard({
  code,
  count,
  rank,
  actions,
  news,
  onSeeAll,
  onClose,
}: {
  code: string;
  count: number;
  rank: number | null; // 1 = most-named country this month
  actions: PulseAction[];
  news: NewsItem[];
  onSeeAll: () => void;
  onClose: () => void;
}) {
  const name = COUNTRY_LABELS[code] ?? code;
  const ref = useRef<HTMLElement>(null);
  // Bring the details into view when a country is pressed and the card opens below the fold.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [code]);
  const mine = actions.filter((a) => parseCountries(a.countries).includes(code));
  const latestActions = mine.slice(0, 3);
  const headlines = news.filter((n) => parseCountries(n.countries).includes(code)).slice(0, 2);

  return (
    <section ref={ref} aria-label={`Details for ${name}`} className="mt-4 rounded-xl border border-white/15 bg-white/[0.05] p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight text-white">{name}</h2>
          <p className="mt-0.5 text-sm text-[#b4b4bc]">
            {count > 0 ? (
              <>
                <span className="font-semibold text-white">
                  {count} U.S. {count === 1 ? 'action' : 'actions'}
                </span>{' '}
                named it in the last 30 days{rank ? `, ${rank === 1 ? 'the most of any country' : `number ${rank} among countries`}` : ''}.
              </>
            ) : (
              'No U.S. actions named it in the last 30 days.'
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-hero-ghost !px-3 !py-1.5 !text-[13px]">
          Close
        </button>
      </div>

      {latestActions.length > 0 && (
        <ul className="mt-3 divide-y divide-white/10">
          {latestActions.map((a) => (
            <li key={a.document_number} className="py-2">
              <div className="flex items-center gap-2 text-xs text-[#b4b4bc]">
                <span className={`h-1.5 w-1.5 rounded-full ${(TAG_HUE[a.tag] ?? TAG_HUE.Other).bg}`} aria-hidden="true" />
                {a.tag}, {friendlyDate(a.publication_date)}
              </div>
              <a href={a.html_url} target="_blank" rel="noreferrer" className="mt-0.5 block text-[15px] leading-snug text-white no-underline hover:underline">
                {a.title}
              </a>
            </li>
          ))}
        </ul>
      )}

      {headlines.length > 0 && (
        <ul className="mt-2 divide-y divide-white/10 border-t border-white/10">
          {headlines.map((n) => (
            <li key={n.id} className="py-2">
              <div className="flex items-center gap-2 text-xs text-[#b4b4bc]">
                <span className={`h-1.5 w-1.5 rounded-full ${(NEWS_HUE[n.category] ?? NEWS_HUE.Official).bg}`} aria-hidden="true" />
                {n.source}, {timeAgo(n.published_at)}
              </div>
              <a href={n.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-[15px] leading-snug text-white no-underline hover:underline">
                {n.title}
              </a>
            </li>
          ))}
        </ul>
      )}

      {latestActions.length === 0 && headlines.length === 0 && count > 0 && (
        <p className="mt-3 text-sm text-[#b4b4bc]">The newest of these are in the U.S. policy tab.</p>
      )}

      <button type="button" onClick={onSeeAll} className="btn-hero mt-3">
        {count > 0 ? `See all ${count} in U.S. policy` : 'Open U.S. policy'}
      </button>
    </section>
  );
}
