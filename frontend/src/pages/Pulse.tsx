import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPulseFeed, getPulseHome, getPulseMarkets, getPulseNews, syncPulse } from '../lib/api';
import { ActiveMeasuresTable } from '../components/ActiveMeasuresTable';
import { PulseAgencyBreakdown } from '../components/PulseAgencyBreakdown';
import { PulseCountryBreakdown } from '../components/PulseCountryBreakdown';
import { PulseCurrencies } from '../components/PulseCurrencies';
import { PulseFeedList } from '../components/PulseFeedList';
import { PulseGlossary } from '../components/PulseGlossary';
import { PulseHero } from '../components/PulseHero';
import { PulseHighlights } from '../components/PulseHighlights';
import { PulseGuide } from '../components/PulseGuide';
import { PulseWelcome, markWelcomed, wasWelcomed } from '../components/PulseWelcome';
import { PulseTabs, PULSE_TABS, type PulseTabId } from '../components/PulseTabs';
import { PulseMarketStrip } from '../components/PulseMarketStrip';
import { PulseCurrencyMovers, PulseLineChart, PulseMoverBars } from '../components/PulseCharts';
import { PulseNews } from '../components/PulseNews';
import { PulsePanel } from '../components/PulsePanel';
import { PulseSignalStrip } from '../components/PulseSignalStrip';
import { PulseTempoChart } from '../components/PulseTempoChart';
import { PulseTopSignals, rankSignals } from '../components/PulseTopSignals';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { agoText } from '../lib/pulsePlain';
import { CustomizeButton, CustomizePanel } from '../components/PulseCustomize';
import {
  NEWS_TOPICS,
  actionMatches,
  describePrefs,
  groupVisible,
  isDefaultPrefs,
  FEED_QUERY_KEYS,
  loadPrefs,
  prefsFromQuery,
  newsMatches,
  savePrefs,
  type PulsePrefs,
} from '../lib/pulsePrefs';
import { GROUP_HUE, SERIES_HUES, TAG_HUE } from '../lib/pulseColors';
import type { PulseHome, ActiveMeasure, NewsCategory, PulseAction, PulseMarkets, PulseNewsResponse, PulseSummary, PulseTag, TempoPoint } from '../types/pulse';

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

// Filter-button styling for the activity list.
const CHIP = 'border px-3 py-1 text-[13px] font-semibold';
const CHIP_ON = 'border-ink bg-ink text-white';
const CHIP_OFF = 'border-hairline-strong bg-paper-raised text-ink-muted hover:border-ink hover:text-ink';

const TAGS: PulseTag[] = ['Tariff', 'Sanctions', 'Export Control', 'Trade Agreement', 'Other'];

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
  const [status, setStatus] = useState<PulseHome['status'] | null>(null);
  const sharedPrefs = useMemo(() => prefsFromQuery(new URLSearchParams(window.location.search)), []);
  const [sharedBanner, setSharedBanner] = useState(sharedPrefs !== null);
  const [prefs, setPrefsState] = useState<PulsePrefs>(() => sharedPrefs ?? loadPrefs());
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [welcomed, setWelcomed] = useState(wasWelcomed);
  const setPrefs = (p: PulsePrefs) => {
    setPrefsState(p);
    savePrefs(p);
  };
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: PulseTabId = PULSE_TABS.some((t) => t.id === tabParam) ? (tabParam as PulseTabId) : 'overview';
  const clearFeedParams = () => {
    const next = new URLSearchParams(params);
    FEED_QUERY_KEYS.forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };
  // Clicking a tab leaves the page where it is: the tab bar is already on
  // screen, so the person keeps their place. Links elsewhere on the page
  // (hero cards, "See all") pass reveal so the new tab's content comes into view.
  const setTab = (id: PulseTabId, reveal = false) => {
    // Keep any shared-feed choices in the address when moving between tabs.
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
    if (reveal) requestAnimationFrame(() => document.getElementById('pulse-tabs')?.scrollIntoView({ block: 'start' }));
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
    // First load comes with the single /home call below; this only keeps a
    // tab that stays open current.
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
    const home = await getPulseHome();
    if (home.tempo) setMonths(home.tempo.months);
    if (home.overlays) setOverlays(home.overlays.overlays);
    if (home.summary) setSummary(home.summary);
    if (home.recent) setRecentAll(home.recent.actions);
    if (home.markets) {
      setMarkets(home.markets);
      setMarketsFailed(false);
    } else {
      setMarketsFailed(true);
    }
    if (home.news) {
      setNews(home.news);
      setNewsFailed(false);
    } else {
      setNewsFailed(true);
    }
    setLoadingNews(false);
    setStatus(home.status);
    // Only complain if the core policy data itself didn't arrive.
    if (!home.summary && !home.recent) throw new Error('The latest data could not be loaded.');
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
    const cols: (keyof PulseAction)[] = ['publication_date', 'title', 'doc_type', 'tag', 'agency', 'citation', 'effective_on', 'comments_close_on', 'html_url'];
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
        className={`${CHIP} ${activeTag === null ? CHIP_ON : CHIP_OFF}`}
      >
        All
      </button>
      {TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setActiveTag(tag)}
          aria-pressed={activeTag === tag}
          className={`${CHIP} inline-flex items-center gap-1.5 ${activeTag === tag ? CHIP_ON : CHIP_OFF}`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${TAG_HUE[tag].bg}`} aria-hidden="true" />
          {tag}
        </button>
      ))}
      {activeCountry && (
        <button type="button" onClick={() => setActiveCountry(null)} className={`${CHIP} ${CHIP_ON}`}>
          {COUNTRY_LABELS[activeCountry] ?? activeCountry} &times;
        </button>
      )}
      <input
        type="search"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search title or abstract"
        className="ml-auto w-48 border border-hairline-strong bg-paper-raised px-2.5 py-1 text-[13px] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      <button type="button" onClick={exportCsv} disabled={actions.length === 0} className="btn">
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
  const worldSeries = seriesFor(['^GSPC', '^GDAXI', '^N225', '^HSI'], {
    '^GSPC': 'S&P 500 (U.S.)',
    '^GDAXI': 'DAX (Germany)',
    '^N225': 'Nikkei 225 (Japan)',
    '^HSI': 'Hang Seng (Hong Kong)',
  });
  const commoditySeries = seriesFor(['CL=F', 'NG=F', 'GC=F', 'HG=F'], { 'CL=F': 'Oil (WTI)', 'NG=F': 'Natural gas', 'GC=F': 'Gold', 'HG=F': 'Copper' });
  const bellwetherMovers = tilesIn('Trade bellwethers').flatMap((t) => {
    const first = t.points[0]?.[1];
    return first ? [{ key: t.id, label: t.label, pct: ((t.points[t.points.length - 1][1] - first) / first) * 100 }] : [];
  });
  const loadingBlock = <p className="text-sm text-ink-faint">Loading…</p>;
  const seeAll = (label: string, to: PulseTabId) => (
    <button type="button" onClick={() => setTab(to, true)} className="mt-3 text-[13px] text-accent hover:underline">
      {label}
    </button>
  );

  const newsPanel = (compact: boolean) =>
    newsFailed && !news ? (
      <p className="text-sm text-ink-faint">Couldn't load news right now.</p>
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
      <p className="text-sm text-ink-faint">Couldn't load currency rates right now.</p>
    ) : (
      <PulseCurrencies rows={(markets?.currencies ?? []).slice(0, rows)} />
    );

  return (
    <div>
      <PulseHero
        summary={summary}
        activeCountry={activeCountry}
        onCountry={setActiveCountry}
        onClearCountry={() => setActiveCountry(null)}
        onSeeAll={() => setTab('policy', true)}
        recent={recentAll}
        news={news?.items ?? []}
        onExplore={() => setTab('policy', true)}
        updatedText={lastSynced ? `Updated ${agoText(lastSynced)}` : 'Not updated yet'}
        syncing={syncing}
        onRefresh={handleRefresh}
      />

      <div className="relative mx-auto -mt-10 max-w-5xl px-4 pb-8">
        {!welcomed && !custom && (
          <PulseWelcome
            onPick={(p) => {
              setPrefs(p.prefs);
              markWelcomed();
              setWelcomed(true);
            }}
            onGuide={() => {
              markWelcomed();
              setWelcomed(true);
              setTab('guide', true);
            }}
            onSkip={() => {
              markWelcomed();
              setWelcomed(true);
            }}
          />
        )}
        {error && (
          <p className="mb-4 border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">
            We couldn't check for updates just now, so you're seeing the most recent saved information. ({error})
          </p>
        )}

        <PulseHighlights
          summary={summary}
          topAction={topAction}
          headline={headline}
          currencies={markets?.currencies ?? []}
          loadingPanels={loadingPanels}
          loadingNews={loadingNews}
          loadingMarkets={!markets && !marketsFailed}
          onTab={(id) => setTab(id, true)}
          showNews={prefs.showNews}
          showMarkets={prefs.showMarkets}
          marketTiles={followedTiles}
          useCurrencies={followsCurrencies}
        />

        <PulseTabs active={tab} onChange={(id) => setTab(id)}>
          <CustomizeButton open={customizeOpen} onClick={() => setCustomizeOpen((o) => !o)} custom={custom} />
        </PulseTabs>

        {sharedBanner && (
          <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-hairline bg-paper-raised px-4 py-2.5 text-[13px] text-ink-muted">
            You're viewing a feed someone shared with you: <span className="text-ink">{feedLabel}.</span>
            <button
              type="button"
              onClick={() => {
                if (sharedPrefs) setPrefs(sharedPrefs);
                setSharedBanner(false);
                clearFeedParams();
              }}
              className="text-accent hover:underline"
            >
              Keep as my feed
            </button>
            <button
              type="button"
              onClick={() => {
                setPrefsState(loadPrefs());
                setSharedBanner(false);
                clearFeedParams();
              }}
              className="text-accent hover:underline"
            >
              Go back to my own
            </button>
          </p>
        )}

        {customizeOpen && (
          <CustomizePanel
            prefs={prefs}
            onChange={setPrefs}
            onClose={() => setCustomizeOpen(false)}
            topCountries={(summary?.countryBreakdown ?? []).map((c) => c.country)}
          />
        )}

        <div role="tabpanel" id="pulse-tabpanel" aria-labelledby={`pulse-tab-${tab}`} className="pt-6">
          {tab === 'overview' && (
            <div className="flex flex-col gap-6">
              {custom && (
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-ink-muted">
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
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="display text-3xl text-ink">Markets</h2>
                    <button type="button" onClick={() => setTab('markets', true)} className="text-[13px] text-accent hover:underline">
                      All markets
                    </button>
                  </div>
                  <PulseMarketStrip tiles={overviewTiles} />
                </section>
              )}
              {overviewCurrencies && (
                <PulsePanel title="Currencies" subtitle={currencySubtitle}>
                  {currenciesPanel(5)}
                  {seeAll('All markets', 'markets')}
                </PulsePanel>
              )}
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                <div className={`min-w-0 ${prefs.showNews ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
                  <PulsePanel
                    title="Top U.S. trade actions"
                    help="The newest government announcements about tariffs (taxes on imports), sanctions and export limits that stand on their own. Routine batches of near-identical notices are left out so the important ones show."
                    subtitle="The most significant recent tariff, sanctions and export-control actions."
                  >
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
                    {seeAll('All U.S. policy', 'policy')}
                  </PulsePanel>
                </div>
                {prefs.showNews && (
                  <div className="min-w-0 lg:col-span-5">
                    <PulsePanel
                      title="Latest headlines"
                      help="Recent news from major outlets that mentions trade, markets or elections. Click a headline to read the full story on the publisher's own site."
                      subtitle="Trade, markets and elections, from BBC, The Guardian, NPR, the ECB and the Fed."
                    >
                      {newsPanel(true)}
                      {seeAll('All news', 'news')}
                    </PulsePanel>
                  </div>
                )}
              </div>
              <PulseGlossary />
            </div>
          )}

          {tab === 'policy' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="display text-3xl text-ink">U.S. policy</h2>
                <p className="mt-1 text-sm text-ink-muted">Tariffs, sanctions and export controls, as published in the Federal Register.</p>
              </div>
              {loadingPanels || !summary ? (
                <div className="card py-6 text-center text-sm text-ink-faint">Loading…</div>
              ) : (
                <PulseSignalStrip summary={summary} activeMeasureCount={overlays.length} />
              )}
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel
                    title="What matters most"
                    help="Actions that stand on their own, ranked by how weighty the document type is (a presidential order or final rule counts for more than a routine notice), then by date. It is a simple sort, not a judgment call by a computer model."
                    subtitle={`Standalone actions only, ranked by document type and then date.${custom ? ' Filtered to your feed.' : ''}`}
                  >
                    {loadingPanels ? (
                      loadingBlock
                    ) : (
                      <PulseTopSignals
                        actions={myActions}
                        emptyText={custom ? 'No recent actions match your topics. Change your feed to widen it.' : undefined}
                      />
                    )}
                  </PulsePanel>
                </div>
                <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
                  <PulsePanel
                    title="Activity by country"
                    help="Countries named in the text of recent actions. It is a best-effort match on the wording, so treat it as a guide. Click a country to filter the activity list."
                    subtitle="Named in the text, last 30 days. Best effort, not authoritative."
                  >
                    {loadingPanels ? (
                      loadingBlock
                    ) : (
                      <PulseCountryBreakdown
                        breakdown={(summary?.countryBreakdown ?? []).slice(0, 8)}
                        activeCountry={activeCountry}
                        onSelect={setActiveCountry}
                      />
                    )}
                  </PulsePanel>
                </div>

                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel
                    title="Full activity"
                    help="Everything collected, newest first. Use the buttons to narrow by topic, or search for a word such as steel or Mexico. Notices that repeat with the same title are grouped so they do not crowd the list."
                  >
                    {TagFilter}
                    {loadingFeed && actions.length === 0 ? (
                      loadingBlock
                    ) : (
                      // Stays mounted while a filter reloads (dimmed) so the page
                      // doesn't shrink and pull the reader's scroll position up.
                      <div className={`max-h-[36rem] overflow-y-auto pr-1 ${loadingFeed ? 'opacity-50' : ''}`} aria-busy={loadingFeed}>
                        <PulseFeedList actions={actions} />
                      </div>
                    )}
                  </PulsePanel>
                </div>
                <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
                  <PulsePanel
                    title="Active measures"
                    help="Extra taxes on imports that the U.S. currently charges under specific laws. Scope shows which countries they cover and rate is the extra percent on top of normal duties."
                    subtitle="Section 232, 301 and 338 measures in force."
                  >
                    {loadingPanels ? loadingBlock : <ActiveMeasuresTable overlays={overlays} />}
                  </PulsePanel>
                  <PulsePanel
                    title="Activity by agency"
                    help="Which government office published each action in the last 30 days. A few offices publish most of them."
                    subtitle="Primary agency, last 30 days."
                  >
                    {loadingPanels ? loadingBlock : <PulseAgencyBreakdown breakdown={summary?.agencyBreakdown ?? []} />}
                  </PulsePanel>
                  <PulsePanel
                    title="Policy tempo"
                    help="How many actions were published each month over the last two years. Taller bars mean a busier month."
                    subtitle="Actions published per month, last 24 months."
                  >
                    {loadingPanels ? loadingBlock : <PulseTempoChart months={months} trendPct={summary?.trendPct ?? null} />}
                  </PulsePanel>
                </div>
              </div>
              <PulseGlossary />
            </div>
          )}

          {tab === 'markets' && (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="display text-3xl text-ink">Markets</h2>
                <p className="mt-1 text-sm text-ink-muted">Stocks, commodities, interest rates and currencies that move with world trade.</p>
              </div>
              {marketsFailed && !markets && <p className="text-sm text-ink-faint">Couldn't load market data right now.</p>}

              {prefs.markets.length > 0 && (
                <p className="flex flex-wrap items-baseline gap-x-2 text-[13px] text-ink-muted">
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
                  <section key={group} className="flex flex-col gap-4">
                    <div>
                      <h3 className="flex items-center gap-2.5 font-display text-xl font-bold text-ink">
                        <span className={`h-3 w-3 rounded-full ${GROUP_HUE[group].bg}`} aria-hidden="true" />
                        {group}
                      </h3>
                      <p className="mt-0.5 text-sm text-ink-faint">{blurb}</p>
                    </div>
                    <PulseMarketStrip tiles={tiles} />
                    {group === 'World stocks' && worldSeries.length > 0 && (
                      <PulsePanel
                        title="How stock markets moved"
                        help="Each line starts at 100 on the first day, so you can compare markets that use very different numbers. A line ending at 105 rose 5% over the period; one ending at 95 fell 5%."
                        subtitle="The U.S., Europe, Japan and Hong Kong over the last three months. Hover for exact values."
                      >
                        <PulseLineChart series={worldSeries} />
                      </PulsePanel>
                    )}
                    {group === 'Trade bellwethers' && (
                      <PulsePanel
                        title="Three-month winners and losers"
                        help="How each share price changed over the last three months. These companies tend to rise and fall with global trade, which is why they are on this page. It is a watch-list, not advice."
                        subtitle="Change in share price over the last three months."
                      >
                        <PulseMoverBars movers={bellwetherMovers} note="Right (green): the share price rose. Left (red): it fell." />
                      </PulsePanel>
                    )}
                    {group === 'Commodities' && commoditySeries.length > 0 && (
                      <PulsePanel
                        title="How commodity prices moved"
                        help="Each line starts at 100 on the first day, so different prices can be compared side by side. Higher means the price rose over the period."
                        subtitle="Oil, gas, gold and copper over the last three months."
                      >
                        <PulseLineChart series={commoditySeries} />
                      </PulsePanel>
                    )}
                  </section>
                );
              })}

              {followsCurrencies && (
                <section className="flex flex-col gap-4">
                  <div>
                    <h3 className="flex items-center gap-2.5 font-display text-xl font-bold text-ink">
                      <span className="h-3 w-3 rounded-full bg-hue-indigo" aria-hidden="true" />
                      Currencies
                    </h3>
                    <p className="mt-0.5 text-sm text-ink-faint">How many units of each currency one U.S. dollar buys.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <PulsePanel
                      title="U.S. dollar vs. trade partners"
                      help="How many units of each currency one U.S. dollar buys. If the number goes up, the dollar got stronger against that currency, so imports from that country get cheaper and U.S. exports there get pricier."
                      subtitle={currencySubtitle}
                    >
                      {currenciesPanel(8)}
                    </PulsePanel>
                    <PulsePanel
                      title="Who moved most"
                      help="Ranks these currencies by how much they changed against the dollar over the last 30 days. Green means the dollar bought more of that currency than before."
                      subtitle="30-day change against the dollar."
                    >
                      <PulseCurrencyMovers rows={markets?.currencies ?? []} />
                    </PulsePanel>
                  </div>
                </section>
              )}

              <p className="text-xs leading-relaxed text-ink-faint">
                Stock, commodity and rate quotes come from Yahoo Finance's public chart data and can lag by about 15 minutes; they are for information, not
                trading. Currency rates are the ECB's daily reference rates, published once per business day.
              </p>
            </div>
          )}

          {tab === 'guide' && <PulseGuide status={status} />}

          {tab === 'news' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="display text-3xl text-ink">News</h2>
                <p className="mt-1 text-sm text-ink-muted">Trade, markets and election headlines from around the world.</p>
              </div>
              <PulsePanel
                title="World news"
                help="Headlines from BBC, The Guardian, NPR, the European Central Bank and the U.S. Federal Reserve, kept only when they are about trade, markets or elections. Click one to read the story at its source."
                subtitle="From BBC, The Guardian, NPR, the ECB and the Fed. Each headline links to the publisher, with its own photo where one is provided."
              >
                {newsPanel(false)}
              </PulsePanel>
            </div>
          )}
        </div>

        <div className="card mt-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Compliance calculator</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Classify a shipment, check origin and screen parties to get a duty determination with sources.</p>
          </div>
          <Link to="/calculator" className="btn shrink-0">
            Open the calculator
          </Link>
        </div>
      </div>
    </div>
  );
}
