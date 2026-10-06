import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPulseHome, getPulseTempo, syncPulse } from '../lib/api';
import { ActiveMeasuresTable } from '../components/ActiveMeasuresTable';
import { InfluenceBlocs } from '../components/InfluenceBlocs';
import { PulseSanctionsBrowser } from '../components/PulseSanctionsBrowser';
import { InfluenceGuide } from '../components/InfluenceGuide';
import { InfluenceHero } from '../components/InfluenceHero';
import { InfluenceTabs, INFLUENCE_TABS, type InfluenceTabId } from '../components/InfluenceTabs';
import { PulseAgencyBreakdown } from '../components/PulseAgencyBreakdown';
import { PulseCountryTariffs } from '../components/PulseCountryTariffs';
import { PulseCurrencies } from '../components/PulseCurrencies';
import { PulseCurrencyMovers } from '../components/PulseCharts';
import { PulseDelta } from '../components/PulseDelta';
import { PulseMacroStrip } from '../components/PulseMacroStrip';
import { PulseMarketStrip } from '../components/PulseMarketStrip';
import { NewsThumb, timeAgo } from '../components/PulseNews';
import { ConvergencePanel } from '../components/ConvergencePanel';
import { PulsePanel } from '../components/PulsePanel';
import { PulseTempoChart, TEMPO_RANGES, type TempoRangeId } from '../components/PulseTempoChart';
import { PulseTopSignals, rankSignals } from '../components/PulseTopSignals';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { agoText, plainSummary } from '../lib/pulsePlain';
import { SITE } from '../lib/site';
import type { ActiveMeasure, NewsItem, PulseAction, PulseMarkets, PulseNewsResponse, PulseSummary, TempoPoint } from '../types/pulse';

// A second lens on the same real Aex Terminal data (see InfluenceGuide
// for exactly what's reused vs. new): pressure = the tariff/sanctions/export
// tools already tracked there; reach = the dollar's reach and
// diplomatic/political news, already collected there too; alliances = one
// new, static, sourced reference file (lib/pulseBlocs.ts). No new backend
// route, no LLM, nothing fabricated -- see routes/pulse.ts for the source.
const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col border-t-4 border-ink p-4">
    <h2 className="font-sans text-[13px] font-semibold tracking-normal text-ink">{label}</h2>
    <div className="mt-2 flex-1">{children}</div>
  </div>
);
const Unavailable = ({ loading }: { loading: boolean }) => <p className="text-sm text-ink-faint">{loading ? 'Loading…' : 'Not available right now.'}</p>;

export function Influence() {
  const [summary, setSummary] = useState<PulseSummary | null>(null);
  const [months, setMonths] = useState<TempoPoint[]>([]);
  const [tempoRange, setTempoRange] = useState<TempoRangeId>('2yr');
  const [overlays, setOverlays] = useState<ActiveMeasure[]>([]);
  const [recentAll, setRecentAll] = useState<PulseAction[]>([]);
  const [markets, setMarkets] = useState<PulseMarkets | null>(null);
  const [marketsFailed, setMarketsFailed] = useState(false);
  const [news, setNews] = useState<PulseNewsResponse | null>(null);
  const [newsFailed, setNewsFailed] = useState(false);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyChecked, setPolicyChecked] = useState<string | null>(null);

  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: InfluenceTabId = INFLUENCE_TABS.some((t) => t.id === tabParam) ? (tabParam as InfluenceTabId) : 'overview';
  const setTab = (id: InfluenceTabId, reveal = false) => {
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
    if (reveal) requestAnimationFrame(() => document.getElementById('influence-tabs')?.scrollIntoView({ block: 'start' }));
  };

  // Guards against a slower, earlier range request resolving after a faster,
  // later one and overwriting it with stale data (e.g. clicking "6mo" then
  // quickly "2yr").
  const tempoRequestId = useRef(0);
  const handleTempoRangeChange = useCallback(async (id: TempoRangeId) => {
    setTempoRange(id);
    const range = TEMPO_RANGES.find((r) => r.id === id);
    if (!range) return;
    const reqId = ++tempoRequestId.current;
    const { months: pts } = await getPulseTempo(range.months);
    if (reqId === tempoRequestId.current) setMonths(pts);
  }, []);

  const loadAll = useCallback(async () => {
    const home = await getPulseHome();
    if (home.tempo) setMonths(home.tempo.months);
    if (home.overlays) setOverlays(home.overlays.overlays);
    if (home.summary) setSummary(home.summary);
    if (home.recent) setRecentAll(home.recent.actions);
    setPolicyChecked(home.status?.policy ?? null);
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
    if (!home.summary && !home.recent) throw new Error('The latest data could not be loaded.');
  }, []);

  useEffect(() => {
    loadAll()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [loadAll]);

  async function handleRefresh() {
    setSyncing(true);
    setError(null);
    try {
      await syncPulse();
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  // Same fix as Pulse.tsx: reflects when the feed was last successfully
  // checked, not the newest document's own date, so a quiet policy day
  // doesn't read as a stale page.
  const lastSynced = policyChecked;
  const topAction = rankSignals(recentAll, 1)[0] ?? null;
  const politicalNews = (news?.items ?? []).filter((n) => n.category === 'Elections & Politics' || n.category === 'Official');
  const headline = politicalNews[0] ?? null;
  const dxy = markets?.tiles.find((t) => t.id === 'DX-Y.NYB') ?? null;
  const tilesIn = (group: string) => (markets?.tiles ?? []).filter((t) => t.group === group);
  const priceTiles = (markets?.tiles ?? []).filter((t) => t.id === 'BLS:IMPORT_PX' || t.id === 'BLS:EXPORT_PX');
  const loadingBlock = <p className="text-sm text-ink-faint">Loading…</p>;
  const seeAll = (label: string, to: InfluenceTabId) => (
    <button type="button" onClick={() => setTab(to, true)} className="mt-3 text-[13px] text-accent hover:underline">
      {label}
    </button>
  );

  return (
    <div>
      <InfluenceHero
        summary={summary}
        markets={markets}
        activeCountry={activeCountry}
        onCountry={setActiveCountry}
        onClearCountry={() => setActiveCountry(null)}
        onSeeAll={() => setTab('pressure', true)}
        recent={recentAll}
        news={news?.items ?? []}
        onExplore={() => setTab('pressure', true)}
        updatedText={lastSynced ? `Updated ${agoText(lastSynced)}` : 'Not updated yet'}
        syncing={syncing}
        onRefresh={handleRefresh}
      />

      <div className="relative mx-auto -mt-10 max-w-7xl px-4 pb-8">
        {error && (
          <p className="mb-4 border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">
            We couldn't check for updates just now, so you're seeing the most recent saved information. ({error})
          </p>
        )}

        <InfluenceTabs active={tab} onChange={(id) => setTab(id)} />

        <div role="tabpanel" id="influence-tabpanel" aria-labelledby={`influence-tab-${tab}`} className="pt-6">
          {tab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="card grid grid-cols-1 divide-y divide-hairline overflow-hidden sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3 lg:divide-x">
                <Item label="Biggest pressure action lately">
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
                    <Unavailable loading={loading} />
                  )}
                </Item>
                <Item label="The dollar's reach">
                  {dxy ? (
                    <>
                      <p className="text-base font-semibold leading-snug text-ink">
                        <PulseDelta change={dxy.changePct} text={`${Math.abs(dxy.changePct ?? 0).toFixed(1)}%`} className="mr-1.5 text-sm" />
                        U.S. dollar index, {dxy.value.toFixed(1)}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                        A gauge of the dollar against a basket of major currencies. Higher means the dollar buys more abroad.
                      </p>
                    </>
                  ) : (
                    <Unavailable loading={!markets && !marketsFailed} />
                  )}
                </Item>
                <Item label="Top diplomatic headline">
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
                    <Unavailable loading={!news && !newsFailed} />
                  )}
                </Item>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
                Every figure above and on the tabs below is a real, sourced number -- the same data behind{' '}
                <Link to="/" className="text-accent hover:underline">
                  {SITE.name}
                </Link>
                , reframed as pressure and reach. See the Guide tab for exactly what that does and doesn't mean.
              </p>
            </div>
          )}

          {tab === 'pressure' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="display text-3xl text-ink">Pressure</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Tariffs, sanctions and export controls: the tools the U.S. uses to raise costs or cut off access, as published in the Federal Register.
                </p>
              </div>
              <PulsePanel
                title="Where pressure converges"
                subtitle="Countries named by several different kinds of source at once, last 60 days"
                help="Pressure rarely arrives from one direction. This ranks countries by how many kinds of source (U.S. actions, news, sanctions or export listings, forced-labor orders) name them, then by how many topics. It is a count of what was published, not a risk score. Open a country to see its full timeline."
              >
                <ConvergencePanel />
              </PulsePanel>
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel
                    title="What matters most"
                    help="Actions that stand on their own, ranked by how weighty the document type is (a presidential order or final rule counts for more than a routine notice), then by date."
                    subtitle="Standalone actions only, ranked by document type and then date."
                  >
                    {loading ? loadingBlock : <PulseTopSignals actions={recentAll} />}
                  </PulsePanel>
                </div>
                <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
                  <PulsePanel
                    title="Who is actually under pressure"
                    help="Real, currently-collected extra duties by country of origin, from the Section 301 forced-labor determination -- not how often a country is mentioned in the news."
                    subtitle="Section 301 forced-labor rate, plus notes on Canada's extra duty and 11 countries' reduced metals rate."
                  >
                    {loading || !summary ? loadingBlock : <PulseCountryTariffs tariffs={summary.countryTariffs} activeCountry={activeCountry} onSelect={setActiveCountry} />}
                  </PulsePanel>
                </div>
                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel
                    title="Active measures"
                    help="Extra taxes on imports the U.S. currently charges under specific laws -- an ongoing exercise of pressure, not a one-time announcement."
                    subtitle="Section 232, 301 and 338 measures in force."
                  >
                    {loading ? loadingBlock : <ActiveMeasuresTable overlays={overlays} />}
                  </PulsePanel>
                </div>
                <div className="grid min-w-0 content-start gap-4 lg:col-span-4">
                  <PulsePanel
                    title="Which office wields it"
                    help="Which government office published each action in the last 30 days."
                    subtitle="Primary agency, last 30 days."
                  >
                    {loading ? loadingBlock : <PulseAgencyBreakdown breakdown={summary?.agencyBreakdown ?? []} />}
                  </PulsePanel>
                  <PulsePanel
                    title="Tempo of pressure"
                    help="How many actions were published each month. Taller bars mean a busier month. Pick a shorter or longer window with the range buttons."
                    subtitle={`Actions published per month, last ${TEMPO_RANGES.find((r) => r.id === tempoRange)?.label ?? '2yr'}.`}
                  >
                    {loading ? (
                      loadingBlock
                    ) : (
                      <PulseTempoChart months={months} trendPct={summary?.trendPct ?? null} range={tempoRange} onRangeChange={handleTempoRangeChange} />
                    )}
                  </PulsePanel>
                </div>
              </div>
              {seeAll(`Full detail on ${SITE.name}`, 'overview')}
            </div>
          )}

          {tab === 'reach' && (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="display text-3xl text-ink">Reach</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Two real proxies, not a measure of favorability: the dollar's reach in world markets, and diplomatic/political news.
                </p>
              </div>
              {marketsFailed && !markets && <p className="text-sm text-ink-faint">Couldn't load market data right now.</p>}
              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">The dollar and world markets</h3>
                <PulseMarketStrip tiles={tilesIn('Rates & dollar')} />
                <PulseMarketStrip tiles={tilesIn('World stocks')} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PulsePanel
                    title="U.S. dollar vs. trade partners"
                    help="How many units of each currency one U.S. dollar buys. A rising number means the dollar reaches further."
                    subtitle="Last 30 days, ECB reference rate."
                  >
                    {marketsFailed && !markets ? <Unavailable loading={false} /> : <PulseCurrencies rows={(markets?.currencies ?? []).slice(0, 8)} />}
                  </PulsePanel>
                  <PulsePanel
                    title="Who moved most"
                    help="Ranks these currencies by how much they changed against the dollar over the last 30 days."
                    subtitle="30-day change against the dollar."
                  >
                    <PulseCurrencyMovers rows={markets?.currencies ?? []} />
                  </PulsePanel>
                </div>
              </section>
              {priceTiles.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h3 className="font-display text-xl font-bold text-ink">Is pressure reaching prices?</h3>
                  <p className="text-sm text-ink-muted">
                    What the U.S. actually pays for imports, and what buyers abroad actually pay for U.S. exports -- the closest real, published read on whether
                    tariffs (and the dollar's moves) are showing up in prices, not just in policy announcements.
                  </p>
                  <PulseMacroStrip tiles={priceTiles} />
                </section>
              )}
              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">Diplomatic and political headlines</h3>
                {newsFailed && !news ? (
                  <p className="text-sm text-ink-faint">Couldn't load news right now.</p>
                ) : politicalNews.length === 0 ? (
                  <p className="text-sm text-ink-faint">{loading ? 'Loading…' : 'No elections, politics or official headlines right now.'}</p>
                ) : (
                  <ul className="card divide-y divide-hairline">
                    {politicalNews.slice(0, 10).map((n: NewsItem) => (
                      <li key={n.id} className="flex gap-3 p-4">
                        <NewsThumb src={n.image_url} className="h-16 w-16 shrink-0 rounded" />
                        <div className="min-w-0">
                          <a
                            href={n.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[15px] font-medium leading-snug text-ink no-underline hover:text-accent"
                          >
                            {n.title}
                          </a>
                          <p className="mt-1 text-xs text-ink-faint">
                            {n.source}, {timeAgo(n.published_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="text-xs leading-relaxed text-ink-faint">
                Stock, commodity and rate quotes come from Yahoo Finance's public chart data and can lag by about 15 minutes; they are for information, not
                trading. Currency rates are the ECB's daily reference rates. News is BBC, The Guardian, NPR, Al Jazeera, Deutsche Welle, CNBC, the ECB and the
                Fed, filtered to their Elections & Politics and Official categories.
              </p>
            </div>
          )}

          {tab === 'alliances' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="display text-3xl text-ink">Alliances</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Formal, public membership in five real groupings, cross-referenced with this month's real country breakdown. See the Guide tab for sources and
                  limits.
                </p>
              </div>
              {loading ? (
                loadingBlock
              ) : (
                <InfluenceBlocs breakdown={summary?.countryBreakdown ?? []} activeCountry={activeCountry} onSelect={setActiveCountry} />
              )}
              {activeCountry && (
                <p className="text-sm text-ink-muted">
                  Selected: <span className="text-ink">{COUNTRY_LABELS[activeCountry] ?? activeCountry}</span>. See its details on the hero above, or{' '}
                  <button type="button" onClick={() => setTab('overview', true)} className="text-accent hover:underline">
                    scroll up
                  </button>
                  .
                </p>
              )}
            </div>
          )}

          {tab === 'sanctions' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="display text-3xl text-ink">Sanctions</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Browse OFAC's Specially Designated Nationals list and the Commerce/State Consolidated Screening List by country. Filtering by country is a
                  text match on each entry's address field, not a normalized code -- see the note below the search box.
                </p>
              </div>
              <PulsePanel title="Sanctioned entities" help="These are the same two lists the compliance calculator screens party names against. This view lets you browse them directly by country instead of one name at a time.">
                <PulseSanctionsBrowser initialCountry={params.get('country') ?? ''} />
              </PulsePanel>
            </div>
          )}

          {tab === 'guide' && <InfluenceGuide />}
        </div>

        <div className="card mt-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{SITE.name}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">The full tariff, sanctions, export-control and markets feed this page's numbers are drawn from.</p>
          </div>
          <Link to="/" className="btn shrink-0">
            Open {SITE.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
