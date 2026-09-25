import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getActiveMeasures, getPulseFeed, getPulseMarkets, getPulseNews, getPulseSummary, getPulseTempo, syncPulse } from '../lib/api';
import { ActiveMeasuresTable } from '../components/ActiveMeasuresTable';
import { PulseAgencyBreakdown } from '../components/PulseAgencyBreakdown';
import { PulseCountryBreakdown } from '../components/PulseCountryBreakdown';
import { PulseCurrencies } from '../components/PulseCurrencies';
import { PulseFeedList } from '../components/PulseFeedList';
import { PulseGlossary } from '../components/PulseGlossary';
import { PulseDigest, PulseHero } from '../components/PulseHero';
import { PulseBanner } from '../components/PulseBanner';
import { PHOTOS } from '../lib/pulsePhotos';
import { PulseTabs, PULSE_TABS, type PulseTabId } from '../components/PulseTabs';
import { PulseMarketStrip } from '../components/PulseMarketStrip';
import { PulseCurrencyMovers, PulseLineChart, PulseMoverBars } from '../components/PulseCharts';
import { PulseNews } from '../components/PulseNews';
import { PulsePanel } from '../components/PulsePanel';
import { PulseSignalStrip } from '../components/PulseSignalStrip';
import { PulseTempoChart } from '../components/PulseTempoChart';
import { PulseTicker } from '../components/PulseTicker';
import { PulseTopSignals, rankSignals } from '../components/PulseTopSignals';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { CustomizeButton, CustomizePanel } from '../components/PulseCustomize';
import {
  NEWS_TOPICS,
  actionMatches,
  describePrefs,
  groupVisible,
  isDefaultPrefs,
  loadPrefs,
  newsMatches,
  savePrefs,
  type PulsePrefs,
} from '../lib/pulsePrefs';
import { GROUP_HUE, SERIES_HUES, TAG_HUE } from '../lib/pulseColors';
import type { ActiveMeasure, NewsCategory, PulseAction, PulseMarkets, PulseNewsResponse, PulseSummary, PulseTag, TempoPoint } from '../types/pulse';

// Market/news data is cached server-side and refreshed on demand when stale
// (routes/pulse.ts), so re-reading it every few minutes keeps a tab that's
// left open current without hammering any upstream source.
const MARKET_POLL_MS = 5 * 60_000;

const MARKET_GROUPS = [
  { group: 'U.S. stocks', blurb: 'How the big U.S. indexes are doing today.' },
  { group: 'World stocks', blurb: 'Major markets in the countries the U.S. trades with most.' },
  { group: 'Trade bellwethers', blurb: 'Companies whose fortunes rise and fall with global trade: shippers, exporters and big importers.' },
  { group: 'Commodities', blurb: 'Raw materials that set shipping and manufacturing costs.' },
  { group: 'Rates & dollar', blurb: 'The cost of borrowing and the strength of the dollar.' },
] as const;

const TAGS: PulseTag[] = ['Tariff', 'Sanctions', 'Export Control', 'Trade Agreement', 'Other'];

// Ranking/ticker material -- a wider, unfiltered sample than the browsable
// feed's default page, fetched once and independent of the tag filter below
// (both the ticker and the top-signals panel need the full category mix).
const SIGNAL_SAMPLE_SIZE = 100; // the feed endpoint's cap; wider so a narrowed feed still has material

export function Pulse() {
  const [actions, setActions] = useState<PulseAction[]>([]);
  const [recentAll, setRecentAll] = useState<PulseAction[]>([]);
  const [months, setMonths] = useState<TempoPoint[]>([]);
  const [overlays, setOverlays] = useState<ActiveMeasure[]>([]);
  const [summary, setSummary] = useState<PulseSummary | null>(null);
  const [activeTag, setActiveTag] = useState<PulseTag | null>(null);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingPanels, setLoadingPanels] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markets, setMarkets] = useState<PulseMarkets | null>(null);
  const [marketsFailed, setMarketsFailed] = useState(false);
  const [news, setNews] = useState<PulseNewsResponse | null>(null);
  const [newsCategory, setNewsCategory] = useState<NewsCategory | null>(null);
  const [newsFailed, setNewsFailed] = useState(false);
  const [loadingNews, setLoadingNews] = useState(true);
  const [prefs, setPrefsState] = useState<PulsePrefs>(loadPrefs);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const setPrefs = (p: PulsePrefs) => {
    setPrefsState(p);
    savePrefs(p);
  };
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: PulseTabId = PULSE_TABS.some((t) => t.id === tabParam) ? (tabParam as PulseTabId) : 'overview';
  const setTab = (id: PulseTabId) => {
    setParams(id === 'overview' ? {} : { tab: id }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  // Independent of the regulatory panels above: a market or news source
  // being down must never blank the Federal Register side of the page.
  useEffect(() => {
    const load = () =>
      getPulseMarkets()
        .then((m) => {
          setMarkets(m);
          setMarketsFailed(false);
        })
        .catch(() => setMarketsFailed(true));
    load();
    const t = setInterval(load, MARKET_POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Fetched once for every category; the News tab's chips filter client-side,
  // so the Overview's headline stays put while someone browses categories.
  useEffect(() => {
    const load = () =>
      getPulseNews(undefined, 60)
        .then((n) => {
          setNews(n);
          setNewsFailed(false);
        })
        .catch(() => setNewsFailed(true))
        .finally(() => setLoadingNews(false));
    load();
    const t = setInterval(load, MARKET_POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Typing shouldn't fire a request per keystroke -- wait for a short pause.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadFeed = useCallback(async (tag: PulseTag | null, country: string | null, q: string) => {
    const { actions } = await getPulseFeed(30, tag ?? undefined, { country: country ?? undefined, search: q || undefined });
    setActions(actions);
  }, []);

  // Every number and ranking on this page comes from plain SQL aggregation
  // (routes/pulse.ts's /summary) or plain client-side sort/group (see
  // lib/pulseGrouping.ts) over data already fetched here -- no Anthropic
  // call, no extra request per stat.
  const loadPanels = useCallback(async () => {
    const [tempo, overlaysRes, summaryRes, recentRes] = await Promise.all([
      getPulseTempo(),
      getActiveMeasures(),
      getPulseSummary(),
      getPulseFeed(SIGNAL_SAMPLE_SIZE),
    ]);
    setMonths(tempo.months);
    setOverlays(overlaysRes.overlays);
    setSummary(summaryRes);
    setRecentAll(recentRes.actions);
  }, []);

  // Tempo/active-measures/summary/signal-sample aren't affected by the tag
  // filter, so they load once on mount, independently of the feed -- a tag
  // click below only refetches the feed, not everything else.
  useEffect(() => {
    setLoadingPanels(true);
    loadPanels()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingPanels(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs on mount (initial feed load) and again whenever a tag, country, or
  // search filter changes, independently of the effect above -- one panel's
  // fetch failing doesn't clear data another panel already loaded, it only
  // reports its own error.
  useEffect(() => {
    setLoadingFeed(true);
    loadFeed(activeTag, activeCountry, search)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingFeed(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag, activeCountry, search]);

  async function handleRefresh() {
    setSyncing(true);
    setError(null);
    try {
      await syncPulse();
      // A sync can touch every table this page reads, so refresh everything
      // together here -- unlike the tag-filter click above, this is one
      // user-initiated action where "did it fully refresh" matters more
      // than isolating each panel's fetch.
      await Promise.all([loadFeed(activeTag, activeCountry, search), loadPanels()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  // Client-side CSV of exactly what's currently loaded in the feed (same
  // filtered set the person is looking at) -- no new backend route, the
  // data's already here. Quotes/commas in title or abstract text are escaped
  // per RFC 4180 (double the quotes, wrap the field), not stripped.
  function exportCsv() {
    const cols: (keyof PulseAction)[] = [
      'publication_date',
      'title',
      'doc_type',
      'tag',
      'agency',
      'citation',
      'effective_on',
      'comments_close_on',
      'html_url',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.join(','), ...actions.map((a) => cols.map((c) => escape(a[c])).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade-policy-pulse-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const lastSynced = recentAll.reduce<string | null>((latest, a) => (!latest || a.fetched_at > latest ? a.fetched_at : latest), null);

  const TagFilter = (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setActiveTag(null)}
        aria-pressed={activeTag === null}
        className={`border px-2.5 py-1 text-xs ${activeTag === null ? 'border-accent text-accent' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
      >
        All
      </button>
      {TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setActiveTag(tag)}
          aria-pressed={activeTag === tag}
          className={`border px-2.5 py-1 text-xs ${activeTag === tag ? 'border-accent text-accent' : 'border-hairline-strong text-ink-muted hover:text-ink'}`}
        >
          <span className={`mr-1.5 inline-block h-2 w-2 ${TAG_HUE[tag].bg}`} aria-hidden="true" />
          {tag}
        </button>
      ))}
      {activeCountry && (
        <button
          type="button"
          onClick={() => setActiveCountry(null)}
          className="border border-accent px-2.5 py-1 text-xs text-accent"
        >
          {COUNTRY_LABELS[activeCountry] ?? activeCountry} &times;
        </button>
      )}
      <input
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search title or abstract"
        className="ml-auto w-48 border border-hairline-strong bg-paper px-2.5 py-1 font-sans text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={exportCsv}
        disabled={actions.length === 0}
        className="border border-hairline-strong px-2.5 py-1 font-mono text-xs text-ink-muted hover:border-accent hover:text-accent disabled:opacity-50"
      >
        Export CSV
      </button>
    </div>
  );

  const custom = !isDefaultPrefs(prefs);
  const myActions = recentAll.filter((a) => actionMatches(a, prefs));
  const topAction = rankSignals(myActions, 1)[0] ?? null;
  const myNewsItems = (news?.items ?? []).filter((n) => newsMatches(n, prefs));
  const myNews = news && { ...news, items: myNewsItems };
  const headline = myNewsItems.find((n) => n.category === 'Trade & Supply Chain') ?? myNewsItems[0] ?? null;
  const newsCatsShown = (prefs.newsCats.length ? NEWS_TOPICS.filter((c) => prefs.newsCats.includes(c)) : [...NEWS_TOPICS]) as NewsCategory[];
  const activeNewsCat = newsCategory && newsCatsShown.includes(newsCategory) ? newsCategory : null;
  const shownNews = myNews && { ...myNews, items: activeNewsCat ? myNewsItems.filter((n) => n.category === activeNewsCat) : myNewsItems };
  const feedLabel = describePrefs(prefs, (c) => COUNTRY_LABELS[c] ?? c);
  const tileById = (id: string) => markets?.tiles.find((t) => t.id === id);
  const tilesIn = (group: string) => (markets?.tiles ?? []).filter((t) => t.group === group);
  // Overview strip: the default five, or -- when the visitor follows specific
  // market groups -- the first tile of each followed group, then the second,
  // and so on until five are shown.
  const followedGroups = MARKET_GROUPS.map((g) => g.group).filter((g) => groupVisible(prefs, g));
  const overviewTiles =
    prefs.markets.length === 0
      ? ['^GSPC', '^IXIC', 'CL=F', '^TNX', 'DX-Y.NYB'].flatMap((id) => tileById(id) ?? [])
      : Array.from({ length: 4 }, (_, i) => followedGroups.flatMap((g) => tilesIn(g)[i] ?? []))
          .flat()
          .slice(0, 5);
  const followedTiles = (markets?.tiles ?? []).filter((t) => groupVisible(prefs, t.group));
  const followsCurrencies = groupVisible(prefs, 'Currencies');
  const overviewCurrencies = prefs.showMarkets && overviewTiles.length === 0 && followsCurrencies;
  const seriesFor = (ids: string[], names: Record<string, string>) =>
    ids.flatMap((id, i) => {
      const t = tileById(id);
      return t ? [{ id, label: names[id], css: SERIES_HUES[i].css, swatch: SERIES_HUES[i].bg, points: t.points }] : [];
    });
  const worldSeries = seriesFor(['^GSPC', '^GDAXI', '^N225', '^HSI'], { '^GSPC': 'S&P 500 (U.S.)', '^GDAXI': 'DAX (Germany)', '^N225': 'Nikkei 225 (Japan)', '^HSI': 'Hang Seng (Hong Kong)' });
  const commoditySeries = seriesFor(['CL=F', 'NG=F', 'GC=F', 'HG=F'], { 'CL=F': 'Oil (WTI)', 'NG=F': 'Natural gas', 'GC=F': 'Gold', 'HG=F': 'Copper' });
  const bellwetherMovers = tilesIn('Trade bellwethers').flatMap((t) => {
    const first = t.points[0]?.[1];
    return first ? [{ key: t.id, label: t.label, pct: ((t.points[t.points.length - 1][1] - first) / first) * 100 }] : [];
  });
  const loadingBlock = <p className="font-sans text-sm text-ink-faint">Loading…</p>;
  const seeAll = (label: string, to: PulseTabId) => (
    <button type="button" onClick={() => setTab(to)} className="mt-3 font-sans text-xs text-accent hover:underline">
      {label}
    </button>
  );

  const newsPanel = (compact: boolean) =>
    newsFailed && !news ? (
      <p className="font-sans text-sm text-ink-faint">Couldn't load news right now.</p>
    ) : (
      <PulseNews
        data={compact ? myNews : shownNews}
        category={activeNewsCat}
        onCategory={setNewsCategory}
        loading={loadingNews}
        compact={compact}
        excludeId={compact ? headline?.id : undefined}
        categories={newsCatsShown}
      />
    );

  const currencySubtitle = `U.S. dollar against trade partners, last 30 days${markets?.currencies[0] ? `, ECB rate for ${markets.currencies[0].asOf}` : ''}. Green up means the dollar buys more.`;
  const currenciesPanel = (rows: number) =>
    marketsFailed && !markets ? (
      <p className="font-sans text-sm text-ink-faint">Couldn't load currency rates right now.</p>
    ) : (
      <PulseCurrencies rows={(markets?.currencies ?? []).slice(0, rows)} />
    );

  return (
    <div>
      <PulseTicker actions={custom && myActions.length > 0 ? myActions : recentAll} lastSynced={lastSynced} />

      <section className="relative isolate overflow-hidden border-b border-hairline">
        <img
          src={PHOTOS.hero.src}
          alt=""
          decoding="async"
          fetchPriority="high"
          width={1400}
          height={925}
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
          style={{ objectPosition: PHOTOS.hero.position }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-paper via-paper/75 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-paper/50 sm:hidden" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-10 bg-gradient-to-t from-paper to-transparent" />
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pb-12 pt-10 font-sans sm:pb-16 sm:pt-16">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Trade Policy Pulse</h1>
            <p className="mt-1.5 max-w-xl text-sm text-ink-muted">What's changing in world trade, in plain English.</p>
            <PulseDigest summary={summary} />
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-ink-faint">
            <span>{lastSynced ? `Updated ${new Date(lastSynced).toLocaleString()}` : 'Not yet synced'}</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={syncing}
              className="border border-hairline-strong px-3 py-1.5 font-sans text-xs text-ink hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {syncing ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        </div>
        <a
          href={PHOTOS.hero.href}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-1.5 right-3 max-w-[85%] truncate font-sans text-[10px] text-ink-faint no-underline hover:text-ink-muted"
        >
          Photo: {PHOTOS.hero.credit}
        </a>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-6 pt-6 font-sans">
        {error && (
          <p className="mb-4 border border-stop bg-stop-soft px-3 py-2 font-sans text-sm text-stop">
            Couldn't refresh -- showing last-synced data. ({error})
          </p>
        )}

        <PulseHero
          summary={summary}
          topAction={topAction}
          headline={headline}
          currencies={markets?.currencies ?? []}
          loadingPanels={loadingPanels}
          loadingNews={loadingNews}
          loadingMarkets={!markets && !marketsFailed}
          onTab={setTab}
          showNews={prefs.showNews}
          showMarkets={prefs.showMarkets}
          marketTiles={followedTiles}
          useCurrencies={followsCurrencies}
        />

        <PulseTabs active={tab} onChange={setTab}>
          <CustomizeButton open={customizeOpen} onClick={() => setCustomizeOpen((o) => !o)} custom={custom} />
        </PulseTabs>

        {customizeOpen && (
          <CustomizePanel
            prefs={prefs}
            onChange={setPrefs}
            onClose={() => setCustomizeOpen(false)}
            topCountries={(summary?.countryBreakdown ?? []).map((c) => c.country)}
          />
        )}

        <div role="tabpanel" id="pulse-tabpanel" aria-labelledby={`pulse-tab-${tab}`} className="pt-5">
          {tab === 'overview' && (
            <div className="flex flex-col gap-5">
              {custom && (
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-sans text-xs text-ink-muted">
                  Showing your feed: <span className="text-ink">{feedLabel}.</span>
                  <button type="button" onClick={() => setCustomizeOpen(true)} className="text-accent hover:underline">
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrefs({ tags: [], newsCats: [], countries: [], markets: [], showNews: true, showMarkets: true })}
                    className="text-accent hover:underline"
                  >
                    Reset
                  </button>
                </p>
              )}
              {prefs.showMarkets && overviewTiles.length > 0 && (
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="font-sans text-sm font-semibold text-ink">Markets at a glance</h2>
                    <button type="button" onClick={() => setTab('markets')} className="font-sans text-xs text-accent hover:underline">
                      See all markets
                    </button>
                  </div>
                  <PulseMarketStrip tiles={overviewTiles} />
                </section>
              )}
              {overviewCurrencies && (
                <div className="grid grid-cols-1 gap-px bg-hairline">
                  <PulsePanel title="Currencies" subtitle={currencySubtitle} accent="bg-cat-blue">
                    {currenciesPanel(5)}
                    {seeAll('See all markets', 'markets')}
                  </PulsePanel>
                </div>
              )}
              <div className="grid grid-cols-1 gap-px bg-hairline lg:grid-cols-12">
                <div className={`min-w-0 ${prefs.showNews ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
                  <PulsePanel title="Top U.S. trade actions" subtitle="The most significant recent tariff, sanctions and export-control actions.">
                    {loadingPanels ? (
                      loadingBlock
                    ) : (
                      <PulseTopSignals
                        actions={myActions}
                        limit={4}
                        skip={topAction?.document_number}
                        emptyText={custom ? 'No recent actions match your topics. Change your feed to widen it.' : undefined}
                      />
                    )}
                    {seeAll('See all U.S. policy', 'policy')}
                  </PulsePanel>
                </div>
                {prefs.showNews && (
                <div className="min-w-0 lg:col-span-5">
                  <PulsePanel title="Latest headlines" subtitle="Trade, markets and elections, from BBC, The Guardian, NPR, the ECB and the Fed.">
                    {newsPanel(true)}
                    {seeAll('See all news', 'news')}
                  </PulsePanel>
                </div>
                )}
              </div>
              <PulseGlossary />
            </div>
          )}

          {tab === 'policy' && (
            <div className="flex flex-col gap-5">
              <PulseBanner photo={PHOTOS.policy} title="U.S. policy" blurb="Tariffs, sanctions and export controls, as they are published in the Federal Register." />
              <PulseGlossary />
              {loadingPanels || !summary ? (
                <div className="border border-hairline bg-paper py-6 text-center font-sans text-sm text-ink-faint">Loading…</div>
              ) : (
                <PulseSignalStrip summary={summary} activeMeasureCount={overlays.length} />
              )}
              <div className="grid grid-cols-1 gap-px bg-hairline lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel
                    title="What matters most"
                    subtitle={`Standalone actions only (not part of a routine batch), ranked by document type and recency. Plain sort, not a model's judgment call.${custom ? ' Filtered to your feed.' : ''}`}
                  >
                    {loadingPanels ? loadingBlock : <PulseTopSignals actions={myActions} emptyText={custom ? 'No recent actions match your topics. Change your feed to widen it.' : undefined} />}
                  </PulsePanel>
                </div>
                <div className="grid min-w-0 gap-px bg-hairline lg:col-span-4">
                  <PulsePanel title="Activity by country" subtitle="Named in the text, last 30 days -- best-effort, not authoritative.">
                    {loadingPanels ? (
                      loadingBlock
                    ) : (
                      <PulseCountryBreakdown breakdown={summary?.countryBreakdown ?? []} activeCountry={activeCountry} onSelect={setActiveCountry} />
                    )}
                  </PulsePanel>
                </div>

                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel title="Full activity">
                    {TagFilter}
                    {loadingFeed ? (
                      loadingBlock
                    ) : (
                      <div className="max-h-[36rem] overflow-y-auto pr-1">
                        <PulseFeedList actions={actions} />
                      </div>
                    )}
                  </PulsePanel>
                </div>
                <div className="grid min-w-0 gap-px bg-hairline lg:col-span-4">
                  <PulsePanel title="Active measures" subtitle="Section 232 / 301 / 338 overlays currently in force.">
                    {loadingPanels ? loadingBlock : <ActiveMeasuresTable overlays={overlays} />}
                  </PulsePanel>
                  <PulsePanel title="Activity by agency" subtitle="Primary agency, last 30 days.">
                    {loadingPanels ? loadingBlock : <PulseAgencyBreakdown breakdown={summary?.agencyBreakdown ?? []} />}
                  </PulsePanel>
                  <PulsePanel title="Policy tempo" subtitle="Actions published per month, last 24 months.">
                    {loadingPanels ? loadingBlock : <PulseTempoChart months={months} trendPct={summary?.trendPct ?? null} />}
                  </PulsePanel>
                </div>
              </div>
            </div>
          )}

          {tab === 'markets' && (
            <div className="flex flex-col gap-8">
              <PulseBanner photo={PHOTOS.markets} title="Markets" blurb="Stocks, commodities, interest rates and currencies that move with world trade." />
              {marketsFailed && !markets && <p className="font-sans text-sm text-ink-faint">Couldn't load market data right now.</p>}

              {prefs.markets.length > 0 && (
                <p className="flex flex-wrap items-baseline gap-x-2 font-sans text-xs text-ink-muted">
                  Showing the market groups you follow: <span className="text-ink">{prefs.markets.join(', ')}.</span>
                  <button type="button" onClick={() => setPrefs({ ...prefs, markets: [] })} className="text-accent hover:underline">
                    Show all
                  </button>
                </p>
              )}

              {MARKET_GROUPS.map(({ group, blurb }) => {
                if (!groupVisible(prefs, group)) return null;
                const tiles = tilesIn(group);
                if (tiles.length === 0) return null;
                return (
                  <section key={group}>
                    <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-ink">
                      <span className={`h-2.5 w-2.5 ${GROUP_HUE[group].bg}`} aria-hidden="true" />
                      {group}
                    </h2>
                    <p className="mb-2 mt-0.5 font-sans text-xs text-ink-faint">{blurb}</p>
                    <PulseMarketStrip tiles={tiles} />
                    {group === 'World stocks' && worldSeries.length > 0 && (
                      <div className="mt-px grid grid-cols-1 gap-px bg-hairline">
                        <PulsePanel title="How stock markets moved" subtitle="The U.S., Europe, Japan and Hong Kong over the last three months. Hover for exact values." accent={GROUP_HUE['World stocks'].bg}>
                          <PulseLineChart series={worldSeries} />
                        </PulsePanel>
                      </div>
                    )}
                    {group === 'Trade bellwethers' && (
                      <div className="mt-px grid grid-cols-1 gap-px bg-hairline">
                        <PulsePanel title="Three-month winners and losers" subtitle="Change in share price over the last three months." accent={GROUP_HUE['Trade bellwethers'].bg}>
                          <PulseMoverBars movers={bellwetherMovers} note="Right (green): the share price rose. Left (red): it fell." />
                        </PulsePanel>
                      </div>
                    )}
                    {group === 'Commodities' && commoditySeries.length > 0 && (
                      <div className="mt-px grid grid-cols-1 gap-px bg-hairline">
                        <PulsePanel title="How commodity prices moved" subtitle="Oil, gas, gold and copper over the last three months." accent={GROUP_HUE.Commodities.bg}>
                          <PulseLineChart series={commoditySeries} />
                        </PulsePanel>
                      </div>
                    )}
                  </section>
                );
              })}

              {followsCurrencies && (
              <section>
                <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-ink">
                  <span className="h-2.5 w-2.5 bg-cat-blue" aria-hidden="true" />
                  Currencies
                </h2>
                <p className="mb-2 mt-0.5 font-sans text-xs text-ink-faint">How many units of each currency one U.S. dollar buys.</p>
                <div className="grid grid-cols-1 gap-px bg-hairline lg:grid-cols-2">
                  <PulsePanel title="U.S. dollar vs. trade partners" subtitle={currencySubtitle}>
                    {currenciesPanel(8)}
                  </PulsePanel>
                  <PulsePanel title="Who moved most" subtitle="30-day change against the dollar.">
                    <PulseCurrencyMovers rows={markets?.currencies ?? []} />
                  </PulsePanel>
                </div>
              </section>
              )}

              <p className="font-sans text-[11px] leading-relaxed text-ink-faint">
                Stock, commodity and rate quotes come from Yahoo Finance's public chart data and can lag by about 15 minutes; they are for information, not
                trading. Currency rates are the ECB's daily reference rates, published once per business day.
              </p>
            </div>
          )}

          {tab === 'news' && (
            <div className="flex flex-col gap-5">
              <PulseBanner photo={PHOTOS.news} title="News" blurb="Trade, markets and election headlines from around the world, with the original photo where the publisher provides one." />
              <div className="grid grid-cols-1 gap-px bg-hairline">
              <PulsePanel
                title="World news"
                subtitle="Trade-relevant headlines from BBC, The Guardian, NPR, the ECB and the Fed, kept only when they match trade or market topics. Headline, link and the publisher's own lead photo where the feed offers one."
              >
                {newsPanel(false)}
              </PulsePanel>
              </div>
            </div>
          )}
        </div>

        <Link
          to="/calculator"
          className="mt-8 flex flex-col gap-1 border border-hairline-strong sm:flex-row sm:items-center sm:justify-between px-4 py-3 no-underline hover:border-accent"
        >
          <span>
            <span className="font-sans text-sm text-ink">Compliance calculator</span>
            <span className="block font-sans text-xs text-ink-faint sm:ml-2 sm:inline">
              Classify a shipment through HTS, USMCA origin, denied-party screening, and duty determination.
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs text-ink-muted">Run a case</span>
        </Link>
      </div>
    </div>
  );
}
