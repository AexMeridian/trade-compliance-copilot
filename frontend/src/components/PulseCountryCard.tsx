import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPulseCountry, getNatoDefenseSpending, type NatoDefenseCountry } from '../lib/api';
import type { NewsCategory, NewsItem, PulseAction, PulseCountryDetail, PulseMarkets, PulseSummary } from '../types/pulse';
import { COUNTRY_LABELS, CURRENCY_FOR, MARKET_TILE_FOR, STATUS_LABEL, parseCountries } from '../lib/pulseCountries';
import { NEWS_HUE, TAG_HUE } from '../lib/pulseColors';
import { friendlyDate, usdCompact } from '../lib/pulsePlain';
import { timeAgo } from './PulseNews';
import { blocsFor, BLOC_LABELS, PARTNER_COUNTRIES } from '../lib/pulseBlocs';
import { freightNoteFor } from '../lib/freightNotes';
import { PulseTempoChart } from './PulseTempoChart';
import { PulseSpark } from './PulseCharts';

// Same order NEWS_HUE/pulseColors.ts lists them in -- trade first, since
// that's this app's own focus, officialdom last.
const NEWS_CATEGORY_ORDER: NewsCategory[] = ['Trade & Supply Chain', 'Markets & Currency', 'Elections & Politics', 'Official'];

// Module-level, not component state, so it survives this component
// unmounting and remounting (the parent only renders it while a country is
// selected -- closing and reopening the same country is a fresh mount).
// Bounded in practice: the globe only ever presses one of the ~35 countries
// in PulseGlobe.tsx's own ID_TO_CODE map, so this never grows unbounded.
// Trades a little staleness (this data only otherwise changes on the
// weekly/daily refresh jobs, same as the rest of this page) for not
// re-querying D1 every time someone reopens a country they already looked at.
const countryDetailCache = new Map<string, PulseCountryDetail>();

// NATO defense spending (Power.tsx's own Alliances-tab source, see its
// header comment for citation/caveats) covers all ~32 NATO members in one
// response -- fetched at most once per page load, the first time a NATO
// member is pressed, and shared by every later click rather than refetched
// or pulled in for the ~40 non-NATO countries that would never use it.
let natoDefensePromise: Promise<Record<string, NatoDefenseCountry>> | null = null;
function loadNatoDefense(): Promise<Record<string, NatoDefenseCountry>> {
  natoDefensePromise ??= getNatoDefenseSpending()
    .then((r) => r.countries)
    .catch(() => ({}));
  return natoDefensePromise;
}

// What the globe shows after a country is pressed: a real snapshot, not just
// trade headlines -- this month's U.S. actions, the latest news (tagged by
// its own real category, so politics/markets/trade read as distinct rather
// than one undifferentiated "news" bucket), the country's FX rate and any
// country-specific tariff rate (both already loaded with the page, so this
// costs no extra request), its formal alliance memberships, and -- fetched
// on demand the moment a country is pressed, since this is the one piece
// that isn't already sitting in page state -- its sanctioned-entity count,
// export-control status, its own measures against the U.S., and a baseline
// region/income/population/GDP snapshot (migration 0022, World Bank) that
// exists for every country the globe can select, not just the ones with
// U.S. trade-policy history -- this is what keeps a country with zero
// tracked actions from reading as an empty/broken card rather than a
// genuinely quiet one. A "full country page" link stays the way into the
// exhaustive versions of all of this (the full duty stack, the full
// sanctions list, the full policy history) -- this card is the at-a-glance
// version, not a replacement.
//
// 'US' is a special case, not a real value of `code`: no action or headline
// is ever tagged with it (see lib/pulseCountries.ts), since the feed's
// country field means "named in the text", and these actions are the U.S.'s
// own. So pressing the United States on the globe shows the feed as a
// whole -- the month's total and its newest items, unfiltered -- and skips
// the per-country sections below that wouldn't mean anything for the
// reporting country itself (its own alliance membership, an FX rate against
// its own dollar, sanctions it levies on itself).
export function PulseCountryCard({
  code,
  count,
  rank,
  summary,
  markets,
  actions,
  news,
  onSeeAll,
  onClose,
}: {
  code: string;
  count: number;
  rank: number | null; // 1 = most-named country this month
  summary: PulseSummary | null;
  markets: PulseMarkets | null;
  actions: PulseAction[];
  news: NewsItem[];
  onSeeAll: () => void;
  onClose: () => void;
}) {
  const isHome = code === 'US';
  const name = isHome ? 'United States' : (COUNTRY_LABELS[code] ?? code);
  const ref = useRef<HTMLElement>(null);
  // Bring the details into view when a country is pressed and the card opens below the fold.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [code]);
  const mine = isHome ? actions : actions.filter((a) => parseCountries(a.countries).includes(code));
  const latestActions = mine.slice(0, 3);
  // Grouped into one section per real category (never a fake empty one --
  // a category with nothing is just left out) instead of one flat list, so
  // "trade news" and "politics news" about the same country read as the
  // distinct things they are rather than one undifferentiated bucket.
  const countryNews = isHome ? news : news.filter((n) => parseCountries(n.countries).includes(code));
  const newsSections = NEWS_CATEGORY_ORDER.map((category) => ({ category, items: countryNews.filter((n) => n.category === category).slice(0, 2) })).filter(
    (s) => s.items.length > 0,
  );
  const homeCount = summary?.last30 ?? 0;

  const blocs = isHome ? [] : blocsFor(code);
  const isNato = blocs.includes('NATO');
  const isNatoPartner = !isHome && PARTNER_COUNTRIES.includes(code);

  const currency = CURRENCY_FOR[code];
  const fxRow = !isHome && currency ? (markets?.currencies.find((c) => c.quote === currency) ?? null) : null;

  // A country's own stock index or notable public company -- the
  // private-sector signal, distinct from the FX rate (a government/central-
  // bank number) above it.
  const marketTileId = !isHome ? MARKET_TILE_FOR[code] : undefined;
  const marketTile = marketTileId ? (markets?.tiles.find((t) => t.id === marketTileId) ?? null) : null;

  // The single most significant country-specific tariff program, if any --
  // forced-labor first (it applies across nearly the whole tariff schedule,
  // not one product), then the Section 232 metals cap, then any Section 338
  // extra duty. Same priority a reader would want, most consequential first.
  const forcedLabor = !isHome ? summary?.countryTariffs.forcedLabor.find((t) => t.country === code) : undefined;
  const capped = !isHome ? summary?.countryTariffs.capped.find((t) => t.country === code) : undefined;
  const extra = !isHome ? summary?.countryTariffs.extra.find((t) => t.country === code) : undefined;
  const tariffFact = forcedLabor
    ? { label: 'Section 301 forced-labor rate', ratePct: forcedLabor.ratePct }
    : capped
      ? { label: 'Section 232 metals cap', ratePct: capped.ratePct }
      : extra
        ? { label: `${extra.program} extra duty`, ratePct: extra.ratePct }
        : null;

  // Everything above costs no extra request -- it's already sitting in page
  // state. Sanctions/export-control/retaliatory-measures aren't, so they're
  // fetched the moment a real (non-U.S.) country is pressed, same endpoint
  // the full country page uses. A request for a country the reader has since
  // clicked away from is dropped rather than overwriting newer data.
  const [detail, setDetail] = useState<PulseCountryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    if (isHome) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    const cached = countryDetailCache.get(code);
    if (cached) {
      setDetail(cached);
      setDetailLoading(false);
      return;
    }
    const reqId = ++requestId.current;
    setDetail(null);
    setDetailLoading(true);
    getPulseCountry(code, name)
      .then((d) => {
        countryDetailCache.set(code, d);
        if (reqId === requestId.current) setDetail(d);
      })
      .catch(() => {
        // Silently dropped: the rest of the card already has real data to
        // show, and an honest "couldn't load this part" caveat per fact
        // below (sdnCount stays unset) beats a page-breaking error banner
        // over a secondary section.
      })
      .finally(() => {
        if (reqId === requestId.current) setDetailLoading(false);
      });
  }, [code, isHome, name]);

  const [natoDefense, setNatoDefense] = useState<Record<string, NatoDefenseCountry> | null>(null);
  useEffect(() => {
    if (!isNato) return;
    let live = true;
    loadNatoDefense().then((d) => {
      if (live) setNatoDefense(d);
    });
    return () => {
      live = false;
    };
  }, [isNato]);
  const natoDefenseLatest = natoDefense?.[code]?.points.length ? natoDefense[code].points[natoDefense[code].points.length - 1] : null;

  // A general industry rule of thumb for ocean/air transit to major U.S.
  // ports -- logistics, not policy. A country-specific lane where this app
  // has one (lib/freightNotes.ts), else a wider regional generalization
  // keyed on the detail fetch's own World Bank region (disclosed as such in
  // the JSX below, not shown as if it were as precise as the ten real lanes).
  const freightNote = !isHome ? freightNoteFor(code, detail?.snapshot?.region) : null;

  return (
    <section ref={ref} aria-label={`Details for ${name}`} className="mt-4 rounded-xl border border-hero-border bg-hero-card-bg p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight text-hero-ink">{name}</h2>
          <p className="mt-0.5 text-sm text-hero-ink-faint">
            {isHome ? (
              <>
                Every action on this page is published by the U.S. government.{' '}
                <span className="font-semibold text-hero-ink">
                  {homeCount} {homeCount === 1 ? 'action' : 'actions'}
                </span>{' '}
                in the last 30 days.
              </>
            ) : count > 0 ? (
              <>
                <span className="font-semibold text-hero-ink">
                  {count} U.S. {count === 1 ? 'action' : 'actions'}
                </span>{' '}
                named it in the last 30 days{rank ? `, ${rank === 1 ? 'the most of any country' : `number ${rank} among countries`}` : ''}.
              </>
            ) : (
              'No U.S. actions named it in the last 30 days.'
            )}
          </p>
          {detail?.snapshot && (
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-hero-ink-faint">
              <span>{detail.snapshot.region}</span>
              {detail.snapshot.capitalCity && (
                <span>
                  <span className="font-semibold text-hero-ink">Capital:</span> {detail.snapshot.capitalCity}
                </span>
              )}
              <span>
                <span className="font-semibold text-hero-ink">{detail.snapshot.incomeLevel}</span>
              </span>
              {detail.snapshot.population !== null && (
                <span>
                  <span className="font-semibold text-hero-ink">Pop.</span> {detail.snapshot.population.toLocaleString('en-US')}
                  {detail.snapshot.populationYear ? ` (${detail.snapshot.populationYear})` : ''}
                </span>
              )}
              {detail.snapshot.gdpUsd !== null && (
                <span>
                  <span className="font-semibold text-hero-ink">GDP</span> {usdCompact(detail.snapshot.gdpUsd)}
                  {detail.snapshot.gdpYear ? ` (${detail.snapshot.gdpYear})` : ''}
                </span>
              )}
            </p>
          )}
          {(blocs.length > 0 || isNatoPartner) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-hero-ink-faint">
              {blocs.length > 0 && (
                <>
                  Member of
                  {blocs.map((b) => (
                    <span key={b} className="rounded-full border border-hero-border px-2 py-0.5 font-semibold text-hero-ink">
                      {BLOC_LABELS[b]}
                    </span>
                  ))}
                </>
              )}
              {isNatoPartner && (
                <span
                  title="A named NATO 'partner across the globe' relationship -- not membership, and not the Article 5 mutual-defense commitment NATO members have."
                  className="rounded-full border border-dashed border-hero-border px-2 py-0.5 font-semibold text-hero-ink"
                >
                  NATO partner
                </span>
              )}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="btn-hero-ghost !px-3 !py-1.5 !text-[13px]">
          Close
        </button>
      </div>

      {(fxRow || marketTile || tariffFact || natoDefenseLatest) && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fxRow && (
            <div className="rounded-lg bg-hero-bg p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-hero-ink-faint">
                    USD/{fxRow.quote}
                    {currency === 'EUR' ? ' (Eurozone)' : ''}
                  </p>
                  <p className="text-sm font-semibold text-hero-ink">
                    {fxRow.rate.toFixed(2)}
                    {fxRow.change30dPct !== null && (
                      <span className={`ml-1.5 font-normal ${fxRow.change30dPct >= 0 ? 'text-clear' : 'text-stop'}`}>
                        {fxRow.change30dPct >= 0 ? '▲' : '▼'} {Math.abs(fxRow.change30dPct).toFixed(1)}% (30d)
                      </span>
                    )}
                  </p>
                </div>
                {fxRow.spark.length > 1 && (
                  <div className="w-20 shrink-0">
                    <PulseSpark values={fxRow.spark} height={28} />
                  </div>
                )}
              </div>
            </div>
          )}
          {marketTile && (
            <div className="rounded-lg bg-hero-bg p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-hero-ink-faint">{marketTile.label}</p>
                  <p className="text-sm font-semibold text-hero-ink">
                    {marketTile.value.toLocaleString('en-US', { maximumFractionDigits: marketTile.value < 10 ? 2 : 0 })}
                    {marketTile.changePct !== null && (
                      <span className={`ml-1.5 font-normal ${marketTile.changePct >= 0 ? 'text-clear' : 'text-stop'}`}>
                        {marketTile.changePct >= 0 ? '▲' : '▼'} {Math.abs(marketTile.changePct).toFixed(1)}%
                      </span>
                    )}
                  </p>
                </div>
                {marketTile.points.length > 1 && (
                  <div className="w-20 shrink-0">
                    <PulseSpark values={marketTile.points.map((p) => p[1])} height={28} />
                  </div>
                )}
              </div>
            </div>
          )}
          {tariffFact && (
            <div className="rounded-lg bg-hero-bg p-2.5">
              <p className="text-xs text-hero-ink-faint">{tariffFact.label}</p>
              <p className="text-sm font-semibold text-hero-ink">{tariffFact.ratePct}%</p>
            </div>
          )}
          {natoDefenseLatest && (
            <div className="rounded-lg bg-hero-bg p-2.5">
              <p className="text-xs text-hero-ink-faint">NATO defense spending, % of GDP</p>
              <p className="text-sm font-semibold text-hero-ink">
                {natoDefenseLatest[1].toFixed(2)}% <span className="font-normal text-hero-ink-faint">({natoDefenseLatest[0].slice(0, 4)})</span>
              </p>
            </div>
          )}
        </div>
      )}

      {freightNote && (
        <p className="mt-2 text-xs text-hero-ink-faint">
          <span className="font-semibold text-hero-ink">{freightNote.fromRegion ? 'Typical shipping lane for this region:' : 'Typical shipping lane:'}</span>{' '}
          {freightNote.mode}, {freightNote.transitRange}. {freightNote.note}
        </p>
      )}

      {!isHome && (detailLoading || detail) && (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-hero-divider pt-3 sm:grid-cols-2 lg:grid-cols-4">
          {detailLoading && !detail ? (
            <p className="col-span-full text-xs text-hero-ink-faint">Checking sanctions, export-control and policy detail…</p>
          ) : (
            detail && (
              <>
                <div>
                  <p className="text-xs text-hero-ink-faint">Sanctioned entities (OFAC/BIS)</p>
                  <p className="text-sm font-semibold text-hero-ink">
                    {detail.sanctions.sdnCount !== null ? detail.sanctions.sdnCount + (detail.sanctions.cslCount ?? 0) : 'Not tracked'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-hero-ink-faint">Export-control status</p>
                  <p className="text-sm font-semibold text-hero-ink">{STATUS_LABEL[detail.exportControl.status]}</p>
                </div>
                <div>
                  <p className="text-xs text-hero-ink-faint">{name}'s own measures vs. the U.S.</p>
                  <p className="text-sm font-semibold text-hero-ink">
                    {detail.retaliatoryMeasures.total > 0 ? `${detail.retaliatoryMeasures.total} on record` : 'None on record'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-hero-ink-faint">Forced-labor enforcement (CBP)</p>
                  <p className="text-sm font-semibold text-hero-ink">
                    {detail.forcedLaborEnforcement.total > 0 ? `${detail.forcedLaborEnforcement.total} on record` : 'None on record'}
                  </p>
                </div>
              </>
            )
          )}
        </div>
      )}

      {!isHome && detail && detail.tempo.length > 1 && (
        <div className="mt-3 border-t border-hero-divider pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-hero-ink-faint">
            Policy tempo, last {Math.min(12, detail.tempo.length)} months
          </p>
          <PulseTempoChart months={detail.tempo.slice(-12)} trendPct={null} />
        </div>
      )}

      {latestActions.length > 0 && (
        <div className="mt-3 border-t border-hero-divider pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-hero-ink-faint">Latest U.S. actions</p>
          <ul className="divide-y divide-hero-divider">
            {latestActions.map((a) => (
              <li key={a.document_number} className="py-2">
                <div className="flex items-center gap-2 text-xs text-hero-ink-faint">
                  <span className={`h-1.5 w-1.5 rounded-full ${(TAG_HUE[a.tag] ?? TAG_HUE.Other).bg}`} aria-hidden="true" />
                  {a.tag}, {friendlyDate(a.publication_date)}
                </div>
                <a
                  href={a.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block text-[15px] leading-snug text-hero-ink no-underline hover:underline"
                >
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {newsSections.map((section) => (
        <div key={section.category} className="mt-3 border-t border-hero-divider pt-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-hero-ink-faint">
            <span className={`h-1.5 w-1.5 rounded-full ${(NEWS_HUE[section.category] ?? NEWS_HUE.Official).bg}`} aria-hidden="true" />
            {section.category}
          </p>
          <ul className="divide-y divide-hero-divider">
            {section.items.map((n) => (
              <li key={n.id} className="py-2">
                <div className="text-xs text-hero-ink-faint">
                  {n.source}, {timeAgo(n.published_at)}
                </div>
                <a href={n.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-[15px] leading-snug text-hero-ink no-underline hover:underline">
                  {n.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {latestActions.length === 0 && newsSections.length === 0 && (isHome ? homeCount > 0 : count > 0) && (
        <p className="mt-3 text-sm text-hero-ink-faint">The newest of these are in the U.S. policy tab.</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={onSeeAll} className="btn-hero">
          {isHome ? `See all ${homeCount} in U.S. policy` : count > 0 ? `See all ${count} in U.S. policy` : 'Open U.S. policy'}
        </button>
        {!isHome && (
          <Link to={`/country/${code}`} className="btn-hero-ghost">
            See how it all connects &rarr;
          </Link>
        )}
      </div>
    </section>
  );
}
