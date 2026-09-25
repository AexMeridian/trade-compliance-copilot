import { useState } from 'react';
import type { NewsCategory, NewsItem, PulseNewsResponse } from '../types/pulse';
import { COUNTRY_LABELS, parseCountries } from '../lib/pulseCountries';
import { NEWS_CATEGORY_HINTS } from '../lib/pulseGlossary';
import { NEWS_HUE } from '../lib/pulseColors';

const CATEGORIES: NewsCategory[] = ['Trade & Supply Chain', 'Markets & Currency', 'Elections & Politics', 'Official'];

// The publisher's own lead image, loaded straight from their CDN. Decorative
// (the headline beside it says the same thing), no referrer sent, and it
// simply disappears if the image can't load, so a dead link never leaves a
// hole in the list.
export function NewsThumb({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 bg-paper-raised object-cover ${className}`}
    />
  );
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function PulseNews({
  data,
  category,
  onCategory,
  loading,
  compact = false,
  excludeId,
  categories = CATEGORIES,
}: {
  data: PulseNewsResponse | null;
  category: NewsCategory | null;
  onCategory: (c: NewsCategory | null) => void;
  loading: boolean;
  // Overview version: newest few headlines only, no category chips or scroll.
  compact?: boolean;
  // A headline already shown elsewhere on the page (the hero card).
  excludeId?: string;
  // Which category chips to offer (a visitor's chosen topics, or all).
  categories?: NewsCategory[];
}) {
  const chip = (active: boolean) =>
    `border px-2.5 py-1 text-xs ${active ? 'border-accent text-accent' : 'border-hairline-strong text-ink-muted hover:text-ink'}`;

  return (
    <div>
      <div className={`mb-3 flex flex-wrap gap-1.5 ${compact ? 'hidden' : ''}`}>
        <button type="button" onClick={() => onCategory(null)} aria-pressed={category === null} className={chip(category === null)}>
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCategory(c)}
            aria-pressed={category === c}
            title={NEWS_CATEGORY_HINTS[c]}
            className={chip(category === c)}
          >
            <span className={`mr-1.5 inline-block h-2 w-2 ${NEWS_HUE[c].bg}`} aria-hidden="true" />
            {c}
            {data?.counts[c] ? <span className="ml-1.5 font-mono text-ink-faint">{data.counts[c]}</span> : null}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <p className="font-sans text-sm text-ink-faint">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="font-sans text-sm text-ink-faint">Nothing here from the last two weeks. If you've customized your feed, try widening your topics or countries.</p>
      ) : (
        <ol className={compact ? '' : 'max-h-[30rem] overflow-y-auto pr-1'}>
          {(compact ? data.items.filter((n) => n.id !== excludeId).slice(0, 5) : data.items).map((n: NewsItem) => {
            const countries = parseCountries(n.countries);
            return (
              <li key={n.id} className="flex gap-3 border-b border-hairline py-3 first:pt-0 last:border-0">
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-faint">
                  <span>{timeAgo(n.published_at)}</span>
                  <span className="text-ink-muted">{n.source}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 ${NEWS_HUE[n.category]?.bg ?? 'bg-cat-gray'}`} aria-hidden="true" />
                    {n.category}
                  </span>
                </div>
                <a href={n.url} target="_blank" rel="noreferrer" className="mt-1 block font-serif text-sm leading-snug text-ink no-underline hover:text-accent">
                  {n.title}
                </a>
                {n.summary && !compact && <p className="mt-1 line-clamp-2 font-sans text-xs text-ink-muted">{n.summary}</p>}
                {countries.length > 0 && (
                  <p className="mt-1 font-sans text-[11px] text-ink-faint">{countries.map((c) => COUNTRY_LABELS[c] ?? c).join(', ')}</p>
                )}
                </div>
                <NewsThumb src={n.image_url} className="h-16 w-24 sm:h-[4.5rem] sm:w-32" />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
