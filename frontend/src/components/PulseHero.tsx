import type { CurrencyRow, MarketTile, NewsItem, PulseAction, PulseSummary } from '../types/pulse';
import { PulseDelta } from './PulseDelta';
import { NewsThumb, timeAgo } from './PulseNews';
import type { PulseTabId } from './PulseTabs';
import { SECTION_HUE } from '../lib/pulseColors';

const DOC_TYPE_PLAIN: Record<string, string> = {
  Rule: 'Final rule',
  'Proposed Rule': 'Proposed rule',
  Notice: 'Notice',
  'Presidential Document': 'Presidential order',
};

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

function Card({ label, hue, children, onClick }: { label: string; hue: { bg: string; text: string }; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className="flex min-w-0 flex-col bg-paper">
      <div className={`h-0.5 ${hue.bg}`} aria-hidden="true" />
      <div className="flex flex-1 flex-col p-4">
      <h2 className={`font-sans text-xs font-medium ${hue.text}`}>{label}</h2>
      <div className="mt-2 flex-1">{children}</div>
      {onClick && (
        <button type="button" onClick={onClick} className="mt-3 self-start font-sans text-xs text-accent hover:underline">
          See more
        </button>
      )}
      </div>
    </div>
  );
}

const Unavailable = ({ loading }: { loading: boolean }) => (
  <p className="font-sans text-sm text-ink-faint">{loading ? 'Loading…' : 'Not available right now.'}</p>
);

// "What most people came here for," in one row: the single most important
// item from each part of the page. Everything is a plain sort or max over
// data the page already fetched -- same no-model rule as the rest of Pulse.
export function PulseHero({
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
  const moverName = mover ? CURRENCY_NAMES[mover.quote] ?? mover.quote : null;
  const tileMover = marketTiles.reduce<MarketTile | null>(
    (best, t) => (t.changePct === null ? best : !best || Math.abs(t.changePct) > Math.abs(best.changePct ?? 0) ? t : best),
    null
  );
  const cards = 2 + (showNews ? 1 : 0) + (showMarkets ? 1 : 0);

  return (
    <div className={`grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-2 ${cards === 4 ? 'lg:grid-cols-4' : cards === 3 ? 'lg:grid-cols-3' : ''}`}>
      <Card label="Biggest U.S. trade action lately" hue={SECTION_HUE.policy} onClick={topAction ? () => onTab('policy') : undefined}>
        {topAction ? (
          <>
            <a
              href={topAction.html_url}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-4 font-serif text-base font-semibold leading-snug text-ink no-underline hover:text-accent"
            >
              {topAction.title}
            </a>
            <p className="mt-2 font-sans text-xs text-ink-muted">
              {DOC_TYPE_PLAIN[topAction.doc_type] ?? topAction.doc_type}, {topAction.publication_date}
            </p>
          </>
        ) : (
          <Unavailable loading={loadingPanels} />
        )}
      </Card>

      {showNews && (
      <Card label="Top trade headline" hue={SECTION_HUE.news} onClick={headline ? () => onTab('news') : undefined}>
        {headline ? (
          <>
            <NewsThumb src={headline.image_url} className="mb-3 h-24 w-full" />
            <a
              href={headline.url}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-4 font-serif text-base font-semibold leading-snug text-ink no-underline hover:text-accent"
            >
              {headline.title}
            </a>
            <p className="mt-2 font-sans text-xs text-ink-muted">
              {headline.source}, {timeAgo(headline.published_at)}
            </p>
          </>
        ) : (
          <Unavailable loading={loadingNews} />
        )}
      </Card>
      )}

      {showMarkets &&
        (useCurrencies && mover && moverName ? (
          <Card label="The dollar this month" hue={SECTION_HUE.markets} onClick={() => onTab('markets')}>
            <p className="font-serif text-base font-semibold leading-snug text-ink">
              <PulseDelta change={mover.change30dPct} text={`${Math.abs(mover.change30dPct ?? 0).toFixed(1)}%`} className="mr-1.5 font-mono text-sm" />
              against {moverName}
            </p>
            <p className="mt-2 font-sans text-xs text-ink-muted">The biggest move among 8 major trade partners. Green means the dollar buys more.</p>
          </Card>
        ) : tileMover ? (
          <Card label="Biggest market move today" hue={SECTION_HUE.markets} onClick={() => onTab('markets')}>
            <p className="font-serif text-base font-semibold leading-snug text-ink">
              <PulseDelta change={tileMover.changePct} text={`${Math.abs(tileMover.changePct ?? 0).toFixed(1)}%`} className="mr-1.5 font-mono text-sm" />
              {tileMover.label}
            </p>
            <p className="mt-2 font-sans text-xs text-ink-muted">The largest daily move among the markets you follow.</p>
          </Card>
        ) : (
          <Card label="Markets" hue={SECTION_HUE.markets}>
            <Unavailable loading={loadingMarkets} />
          </Card>
        ))}

      <Card label="Open for public comment" hue={SECTION_HUE.comment} onClick={summary && summary.openForComment > 0 ? () => onTab('policy') : undefined}>
        {summary ? (
          <>
            <p className="font-mono text-3xl font-semibold text-ink">{summary.openForComment}</p>
            <p className="mt-2 font-sans text-xs text-ink-muted">
              Proposed U.S. trade rules that anyone can still comment on before they become final.
            </p>
          </>
        ) : (
          <Unavailable loading={loadingPanels} />
        )}
      </Card>
    </div>
  );
}

// One plain sentence that summarises the month, built from the same SQL
// summary the Policy tab uses -- reads as a lede, not a dashboard.
export function PulseDigest({ summary }: { summary: PulseSummary | null }) {
  if (!summary) return null;
  return (
    <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-ink-muted">
      <span className="text-ink">{summary.last30} new U.S. trade actions</span> in the last 30 days
      {summary.trendPct !== null && (
        <>
          {' '}
          (<PulseDelta change={summary.trendPct} text={`${Math.abs(summary.trendPct)}%`} /> from the 30 days before)
        </>
      )}
      {summary.leadingTag ? `, mostly ${summary.leadingTag.toLowerCase()}` : ''}.
    </p>
  );
}
