import type { CurrencyRow, MarketTile, NewsItem, PulseAction, PulseSummary } from '../types/pulse';
import { PulseDelta } from './PulseDelta';
import { NewsThumb, timeAgo } from './PulseNews';
import type { PulseTabId } from './PulseTabs';
import { plainSummary } from '../lib/pulsePlain';
import { SECTION_HUE, type Hue } from '../lib/pulseColors';

const CURRENCY_NAMES: Record<string, string> = {
  EUR: 'the euro',
  CNY: 'the Chinese yuan',
  JPY: 'the Japanese yen',
  MXN: 'the Mexican peso',
  CAD: 'the Canadian dollar',
  GBP: 'the British pound',
  INR: 'the Indian rupee',
  KRW: 'the South Korean won',
};

// The pair that moved most over the past 30 days, by absolute change --
// a plain max, so the card always shows the biggest swing, up or down.
function biggestMover(rows: CurrencyRow[]): CurrencyRow | null {
  return rows.reduce<CurrencyRow | null>((best, r) => {
    if (r.change30dPct === null) return best;
    return !best || Math.abs(r.change30dPct) > Math.abs(best.change30dPct ?? 0) ? r : best;
  }, null);
}

function Item({ label, hue, children, more }: { label: string; hue: Hue; children: React.ReactNode; more?: { text: string; onClick: () => void } }) {
  return (
    <div className={`flex min-w-0 flex-col border-t-4 p-4 ${hue.border}`}>
      <h2 className={`font-sans text-[13px] font-semibold tracking-normal ${hue.text}`}>{label}</h2>
      <div className="mt-2 flex-1">{children}</div>
      {more && (
        <button type="button" onClick={more.onClick} className="mt-3 self-start text-[13px] text-accent hover:underline">
          {more.text}
        </button>
      )}
    </div>
  );
}

const Unavailable = ({ loading }: { loading: boolean }) => <p className="text-sm text-ink-faint">{loading ? 'Loading…' : 'Not available right now.'}</p>;

// The single most important item from each part of the page, in one row.
// Everything is a plain sort or max over data the page already fetched (no
// model involved).
export function PulseHighlights({
  summary,
  topAction,
  headline,
  currencies,
  loadingPanels,
  loadingNews,
  loadingMarkets,
  onTab,
  showNews,
  showMarkets,
  marketTiles,
  useCurrencies,
}: {
  summary: PulseSummary | null;
  topAction: PulseAction | null;
  headline: NewsItem | null;
  currencies: CurrencyRow[];
  loadingPanels: boolean;
  loadingNews: boolean;
  loadingMarkets: boolean;
  onTab: (tab: PulseTabId) => void;
  showNews: boolean;
  showMarkets: boolean;
  marketTiles: MarketTile[]; // the tiles the visitor follows
  useCurrencies: boolean; // whether currencies are among what they follow
}) {
  const mover = biggestMover(currencies);
  const moverName = mover ? (CURRENCY_NAMES[mover.quote] ?? mover.quote) : null;
  const tileMover = marketTiles.reduce<MarketTile | null>(
    (best, t) => (t.changePct === null ? best : !best || Math.abs(t.changePct) > Math.abs(best.changePct ?? 0) ? t : best),
    null,
  );
  const cards = 2 + (showNews ? 1 : 0) + (showMarkets ? 1 : 0);

  return (
    <div
      className={`card overflow-hidden grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 ${
        cards === 4 ? 'lg:grid-cols-4 lg:divide-x' : cards === 3 ? 'lg:grid-cols-3 lg:divide-x' : 'lg:divide-x'
      }`}
    >
      <Item
        label="Biggest U.S. trade action lately"
        hue={SECTION_HUE.policy}
        more={topAction ? { text: 'More U.S. policy', onClick: () => onTab('policy') } : undefined}
      >
        {topAction ? (
          <>
            <a
              href={topAction.html_url}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-4 font-display text-[20px] font-bold leading-[1.15] text-ink no-underline hover:text-accent"
            >
              {topAction.title}
            </a>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{plainSummary(topAction)}</p>
          </>
        ) : (
          <Unavailable loading={loadingPanels} />
        )}
      </Item>

      {showNews && (
        <Item label="Top trade headline" hue={SECTION_HUE.news} more={headline ? { text: 'More news', onClick: () => onTab('news') } : undefined}>
          {headline ? (
            <>
              <NewsThumb src={headline.image_url} className="mb-3 h-24 w-full" />
              <a
                href={headline.url}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-4 font-display text-[20px] font-bold leading-[1.15] text-ink no-underline hover:text-accent"
              >
                {headline.title}
              </a>
              <p className="mt-2 text-[13px] text-ink-muted">
                {headline.source}, {timeAgo(headline.published_at)}
              </p>
            </>
          ) : (
            <Unavailable loading={loadingNews} />
          )}
        </Item>
      )}

      {showMarkets &&
        (useCurrencies && mover && moverName ? (
          <Item label="The dollar this month" hue={SECTION_HUE.markets} more={{ text: 'All markets', onClick: () => onTab('markets') }}>
            <p className="text-base font-semibold leading-snug text-ink">
              <PulseDelta change={mover.change30dPct} text={`${Math.abs(mover.change30dPct ?? 0).toFixed(1)}%`} className="mr-1.5 text-sm" />
              against {moverName}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">The biggest move among 8 major trade partners. Green means the dollar buys more.</p>
          </Item>
        ) : tileMover ? (
          <Item label="Biggest market move today" hue={SECTION_HUE.markets} more={{ text: 'All markets', onClick: () => onTab('markets') }}>
            <p className="text-base font-semibold leading-snug text-ink">
              <PulseDelta change={tileMover.changePct} text={`${Math.abs(tileMover.changePct ?? 0).toFixed(1)}%`} className="mr-1.5 text-sm" />
              {tileMover.label}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">The largest daily move among the markets you follow.</p>
          </Item>
        ) : (
          <Item label="Markets" hue={SECTION_HUE.markets}>
            <Unavailable loading={loadingMarkets} />
          </Item>
        ))}

      <Item
        label="Open for public comment"
        hue={SECTION_HUE.comment}
        more={summary && summary.openForComment > 0 ? { text: 'See the proposals', onClick: () => onTab('policy') } : undefined}
      >
        {summary ? (
          <>
            <p className="display text-6xl text-ink">{summary.openForComment}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              Proposed U.S. trade rules that anyone can still comment on before they become final.
            </p>
          </>
        ) : (
          <Unavailable loading={loadingPanels} />
        )}
      </Item>
    </div>
  );
}
