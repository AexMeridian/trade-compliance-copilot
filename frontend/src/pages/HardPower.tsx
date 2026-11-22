import { SectionHeader } from '../components/SectionHeader';
import { Sparkline } from '../components/Sparkline';
import { StatTile } from '../components/StatTile';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPower, getNatoDefenseSpending, getPulseCoferHistory, getPulseHome, getPulseTempo, getTicHolders, type NatoDefenseCountry, type PowerIndicator, type TicHolders as TicData } from '../lib/api';
import { TicHolders } from '../components/TicHolders';
import { IndicatorExplorer } from '../components/IndicatorExplorer';
import { NatoSpendingBars, NATO_MEMBER_COUNT, NATO_TABLE_COUNT, natoLatestRows } from '../components/NatoSpendingBars';
import { SanctionsLeaders } from '../components/SanctionsLeaders';
import { ActiveMeasuresTable } from '../components/ActiveMeasuresTable';
import { InfluenceBlocs } from '../components/InfluenceBlocs';
import { HardPowerGuide } from '../components/HardPowerGuide';
import { HardPowerHero } from '../components/HardPowerHero';
import { RecentListings } from '../components/RecentListings';
import { PulseSanctionsBrowser } from '../components/PulseSanctionsBrowser';
import { PulseTariffBrowser } from '../components/PulseTariffBrowser';
import { PulseExportChart } from '../components/PulseExportChart';
import { CountryCompare } from './CountryCompare';
import { PowerCoferChart } from '../components/PowerCoferChart';
import { CiteThisButton } from '../components/CiteThisButton';
import { SectionTabs } from '../components/SectionTabs';
import { HARD_TABS, hardTabFrom, type HardTabId } from '../lib/powerTabs';
import { PulseAgencyBreakdown } from '../components/PulseAgencyBreakdown';
import { PulseCountryTariffs } from '../components/PulseCountryTariffs';
import { PulseCurrencies } from '../components/PulseCurrencies';
import { PulseCurrencyMovers } from '../components/PulseCharts';
import { PulseMarketStrip } from '../components/PulseMarketStrip';
import { NewsThumb, timeAgo } from '../components/PulseNews';
import { ConvergencePanel } from '../components/ConvergencePanel';
import { PulsePanel } from '../components/PulsePanel';
import { PulseTempoChart, TEMPO_RANGES, type TempoRangeId } from '../components/PulseTempoChart';
import { PulseTopSignals, rankSignals } from '../components/PulseTopSignals';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { quarterLabel } from '../lib/powerFormat';
import { collectedText, plainSummary } from '../lib/pulsePlain';
import { downloadCsv } from '../lib/downloadCsv';
import { SITE } from '../lib/site';
import type { ActiveMeasure, PulseAction, PulseMarkets, PulseNewsResponse, PulseSummary, TempoPoint } from '../types/pulse';

// A third lens on the same real Aex Terminal data (see PowerGuide for
// exactly what's reused vs. new): hard power = the same tariff/sanctions/
// export tools Influence's Pressure tab already tracks; soft power = the
// dollar's reach Influence's Reach tab already tracks, PLUS one genuinely
// new data point (IMF COFER, the dollar's reserve-currency share); alliances
// = the same static, sourced bloc file Influence uses. No new fabricated
// score anywhere -- see routes/pulse.ts and lib/pulse/cofer.ts for sources.
const Item = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="card relative flex min-w-0 flex-col overflow-hidden px-4 pb-4 pt-5">
    <span className="absolute inset-x-0 top-0 h-1 bg-hard" aria-hidden="true" />
    <h2 className="font-sans text-[13px] font-semibold tracking-normal text-ink">{label}</h2>
    <div className="mt-2 flex-1">{children}</div>
  </div>
);
const Unavailable = ({ loading }: { loading: boolean }) => <p className="text-sm text-ink-faint">{loading ? 'Loading…' : 'Not available right now.'}</p>;

export function HardPower() {
  const [summary, setSummary] = useState<PulseSummary | null>(null);
  const [months, setMonths] = useState<TempoPoint[]>([]);
  const [tempoRange, setTempoRange] = useState<TempoRangeId>('2yr');
  const [overlays, setOverlays] = useState<ActiveMeasure[]>([]);
  const [recentAll, setRecentAll] = useState<PulseAction[]>([]);
  const [markets, setMarkets] = useState<PulseMarkets | null>(null);
  const [marketsFailed, setMarketsFailed] = useState(false);
  const [news, setNews] = useState<PulseNewsResponse | null>(null);
  const [newsFailed, setNewsFailed] = useState(false);
  const [coferPoints, setCoferPoints] = useState<[string, number][]>([]);
  const [coferEur, setCoferEur] = useState<[string, number][]>([]);
  const [coferCny, setCoferCny] = useState<[string, number][]>([]);
  const [tic, setTic] = useState<TicData | null>(null);
  const [natoDefense, setNatoDefense] = useState<Record<string, NatoDefenseCountry>>({});
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sanctionsCountry, setSanctionsCountry] = useState<string>('');
  const [policyChecked, setPolicyChecked] = useState<string | null>(null);
  const [power, setPower] = useState<PowerIndicator[]>([]);

  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: HardTabId = hardTabFrom(tabParam);
  const setTab = (id: HardTabId, reveal = false) => {
    const next = new URLSearchParams(params);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
    if (reveal) requestAnimationFrame(() => document.getElementById('hard-tabs')?.scrollIntoView({ block: 'start' }));
  };

  // Guards against a slower, earlier range request resolving after a faster,
  // later one and overwriting it with stale data (e.g. clicking "6mo" then
  // quickly "2yr").
  // A link that names a tab and the countries or country to show (from a country page, search or a shared URL) should open on
  // that tab, not at the top of a long page the reader then has to scroll past.
  useEffect(() => {
    if (tab !== 'overview' && (params.has('countries') || params.has('country'))) {
      requestAnimationFrame(() => document.getElementById('hard-tabs')?.scrollIntoView({ block: 'start' }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const [home, cofer, natoDef, ticData] = await Promise.all([
      getPulseHome(),
      getPulseCoferHistory().catch(() => ({ points: [] as [string, number][], eur: [] as [string, number][], cny: [] as [string, number][] })),
      getNatoDefenseSpending().catch(() => ({ countries: {} as Record<string, NatoDefenseCountry> })),
      getTicHolders().catch(() => null),
    ]);
    setTic(ticData);
    if (home.tempo) setMonths(home.tempo.months);
    if (home.overlays) setOverlays(home.overlays.overlays);
    if (home.summary) setSummary(home.summary);
    if (home.recent) setRecentAll(home.recent.actions);
    setPolicyChecked(home.status?.policy ?? null);
    setCoferPoints(cofer.points);
    setCoferEur(cofer.eur ?? []);
    setCoferCny(cofer.cny ?? []);
    setNatoDefense(natoDef.countries);
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

  // The country measures that sit on the hard-power side (economic weight, investment, high-tech trade, defense), from the same weekly
  // indicator store the Soft Power page reads.
  useEffect(() => {
    let cancelled = false;
    getPower(['US', 'CN'])
      .then((r) => !cancelled && setPower(r.indicators.filter((i) => i.dimension === 'hard_power')))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
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
      // Data refreshes on a schedule on the server; this button just reloads what is stored.
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const lastSynced = policyChecked;
  const topAction = rankSignals(recentAll, 1)[0] ?? null;
  const politicalNews = (news?.items ?? []).filter((n) => n.category === 'Elections & Politics' || n.category === 'Official');
  const headline = politicalNews[0] ?? null;
  const tilesIn = (group: string) => (markets?.tiles ?? []).filter((t) => t.group === group);
  const isDefense = (id: string) => id.startsWith('military_');
  const loadingBlock = <p className="text-sm text-ink-faint">Loading…</p>;
  const seeAll = (label: string, to: HardTabId) => (
    <button type="button" onClick={() => setTab(to, true)} className="mt-3 text-[13px] text-accent hover:underline">
      {label}
    </button>
  );

  const coferLatest = coferPoints.length > 0 ? { date: coferPoints[coferPoints.length - 1][0], value: coferPoints[coferPoints.length - 1][1] } : null;
  const natoRows = natoLatestRows(natoDefense);
  const natoLatest = natoRows.map((r) => r.value).sort((a, b) => a - b);
  // Defense spending is stored as a share of GDP; the median is the middle country, so one outlier cannot move it.
  const natoMedian = natoLatest.length > 0 ? (natoLatest.length % 2 ? natoLatest[(natoLatest.length - 1) / 2] : (natoLatest[natoLatest.length / 2 - 1] + natoLatest[natoLatest.length / 2]) / 2) : null;
  const coferEarliest = coferPoints.length > 0 ? { date: coferPoints[0][0], value: coferPoints[0][1] } : null;

  return (
    <div className="overflow-x-clip">
      <HardPowerHero
        summary={summary}
        markets={markets}
        activeCountry={activeCountry}
        onCountry={setActiveCountry}
        onClearCountry={() => setActiveCountry(null)}
        onSeeAll={() => setTab('trade', true)}
        recent={recentAll}
        news={news?.items ?? []}
        onExplore={() => setTab('trade', true)}
        updatedText={collectedText(lastSynced)}
        syncing={syncing}
        onRefresh={handleRefresh}
        coferPoints={coferPoints}
        natoDefense={natoDefense}
      />

      <div className="page-glow page-glow-hard mx-auto mt-0 max-w-7xl px-4 pb-8">
        {error && (
          <p className="mb-4 border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">
            We couldn't check for updates just now, so you're seeing the most recent saved information. ({error})
          </p>
        )}

        <SectionTabs tabs={HARD_TABS} active={tab} onChange={(id) => setTab(id)} idPrefix="hard" label="Hard Power sections" />

        <div role="tabpanel" id="hard-tabpanel" aria-labelledby={`hard-tab-${tab}`} className="pt-5">
          {tab === 'overview' && (
            <div className="flex flex-col gap-6">
              {(summary || coferLatest || tic?.countries[0] || natoMedian !== null) && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {summary && (
                    <StatTile
                      tone="hard"
                      label="Federal Register trade notices, last 30 days"
                      figure={String(summary.last30)}
                      note={summary.trendPct === null ? 'No earlier period to compare.' : `${summary.trendPct >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(summary.trendPct))}% on the 30 days before. Counts notices, including corrections and comment periods; small swings are noise.`}
                      visual={<Sparkline points={months.map((m, i) => [i, m.count] as [number, number])} color="var(--color-hard)" width={160} height={34} fill />}
                      onClick={() => setTab('trade', true)}
                    />
                  )}
                  {coferLatest && (
                    <StatTile
                      tone="hard"
                      label="Dollar share of world FX reserves"
                      figure={`${coferLatest.value.toFixed(0)}%`}
                      note={`${quarterLabel(coferLatest.date)}, IMF COFER, at market exchange rates${coferEarliest && coferEarliest.date !== coferLatest.date ? `; ${coferEarliest.value.toFixed(0)}% in ${coferEarliest.date.slice(0, 4)}` : ''}. Part of any move is valuation.`}
                      visual={<Sparkline points={coferPoints.map((p, i) => [i, p[1]] as [number, number])} color="var(--color-hard)" width={160} height={34} fill />}
                      onClick={() => setTab('money', true)}
                    />
                  )}
                  {tic?.countries[0] && (
                    <StatTile
                      tone="hard"
                      label="Largest foreign holder of U.S. Treasuries"
                      figure={`$${Math.round(tic.countries[0].billions).toLocaleString('en-US')}B`}
                      note={`${tic.countries[0].label}, ${tic.countries[0].asOf}.`}
                      visual={<Sparkline points={tic.countries[0].history.map((p, i) => [i, p[1]] as [number, number])} color="var(--color-hard)" width={160} height={34} fill />}
                      onClick={() => setTab('money', true)}
                    />
                  )}
                  {natoMedian !== null && (
                    <StatTile
                      tone="hard"
                      label={natoLatest.length >= NATO_TABLE_COUNT ? 'NATO allies: median defense spending' : `Median of ${natoLatest.length} of ${NATO_MEMBER_COUNT} allies: defense spending`}
                      figure={`${natoMedian.toFixed(1)}%`}
                      note={`Share of GDP, NATO's estimates (${[...new Set(natoRows.map((r) => r.year))].sort().join(', ')}). ${natoLatest.length >= NATO_TABLE_COUNT ? `Median of the ${natoLatest.length} allies in NATO's table (not Iceland, which has no armed forces).` : `Only ${natoLatest.length} of ${NATO_MEMBER_COUNT} allies are stored, so this is not the alliance median.`} Targets: 2% guideline, and 3.5% core plus 1.5% related by 2035.`}
                      onClick={() => setTab('military', true)}
                    />
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
                <Item label="Biggest trade action lately">
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
                <Item label="The dollar's reserve share">
                  {coferLatest ? (
                    <>
                      <p className="text-base font-semibold leading-snug text-ink">
                        <span className="mr-1.5 text-2xl tabular-nums">{coferLatest.value.toFixed(0)}%</span>
                        of world FX reserves
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                        {coferEarliest && coferEarliest.date !== coferLatest.date
                          ? `${quarterLabel(coferLatest.date)}; ${coferEarliest.value.toFixed(0)}% in ${coferEarliest.date.slice(0, 4)}, the year the euro began (IMF COFER, at market exchange rates, so a weaker dollar lowers the share without any selling).`
                          : `${quarterLabel(coferLatest.date)}. IMF COFER, the U.S. dollar share of allocated reserves.`}
                      </p>
                    </>
                  ) : (
                    <Unavailable loading={loading} />
                  )}
                </Item>
                <Item label="Latest politics headline">
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

              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">Trade measures</h3>
                <PulsePanel
                  title="Where measures converge"
                  subtitle="Countries named by several different kinds of source at once, last 60 days"
                  help="This ranks countries by how many kinds of source (U.S. actions, news, sanctions or export listings, forced-labor orders) name them. It is a count of what was published, not a risk score."
                >
                  <ConvergencePanel />
                </PulsePanel>
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
                  <div className="min-w-0 lg:col-span-8">
                    <PulsePanel title="What matters most" subtitle="Standalone actions only, ranked by document type and then date." help="An editorial weighting, not a measure of impact: a presidential order or final rule is placed above a routine notice.">
                      {loading ? loadingBlock : <PulseTopSignals actions={recentAll} />}
                    </PulsePanel>
                  </div>
                  <div className="min-w-0 lg:col-span-4">
                    <PulsePanel title="Rate under the 2026 forced-labor Section 301 action" subtitle="One action only. China's 2018-onward Section 301 duties and other measures are not in this figure." help="The extra duty each economy faces under the July 2026 Section 301 forced-labor action, as collected today. It is not a country's total U.S. tariff: the 2018-onward Section 301 duties on China, Section 232 product duties and antidumping/countervailing duties are not included, so a country can face far more than the rate shown.">
                      {loading || !summary ? loadingBlock : <PulseCountryTariffs tariffs={summary.countryTariffs} activeCountry={activeCountry} onSelect={setActiveCountry} />}
                    </PulsePanel>
                  </div>
                  <div className="min-w-0 lg:col-span-8">
                    <PulsePanel title="Active measures" subtitle="Section 232, 301 and 338 measures in force." help="Extra taxes on imports the U.S. currently charges under specific laws: an ongoing measure, not a one-time announcement.">
                      {loading ? loadingBlock : <ActiveMeasuresTable overlays={overlays} />}
                    </PulsePanel>
                  </div>
                  <div className="min-w-0 lg:col-span-4">
                    <PulsePanel title="Pace of U.S. trade actions" subtitle={`Actions published per month, last ${TEMPO_RANGES.find((r) => r.id === tempoRange)?.label ?? '2yr'}.`} help="Taller bars mean a busier month.">
                      {loading ? loadingBlock : <PulseTempoChart months={months} trendPct={summary?.trendPct ?? null} range={tempoRange} onRangeChange={handleTempoRangeChange} />}
                    </PulsePanel>
                  </div>
                </div>
                {seeAll('All trade tools', 'trade')}
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">Sanctions</h3>
                <PulsePanel title="Recently listed" help="Parties added to the UN Security Council, UK and U.S. Commerce/State lists in the last 30 days, by each list's own listing date.">
                  <RecentListings />
                </PulsePanel>
                {seeAll('Browse sanctioned entities', 'sanctions')}
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">Money and the dollar</h3>
                {coferPoints.length > 0 && (
                  <PulsePanel title="Percent of world FX reserves held in U.S. dollars" subtitle={`Quarterly since 1999, latest ${coferLatest ? quarterLabel(coferLatest.date) : ''}.`} help="IMF COFER: the currency composition of official foreign-exchange reserves, at current exchange rates. A weaker dollar lowers the share even if no central bank sold dollars, so part of any move is valuation.">
                    <PowerCoferChart points={coferPoints} eur={coferEur} cny={coferCny} />
                  </PulsePanel>
                )}
                {tic && tic.countries.length > 0 && (
                  <PulsePanel title="Largest foreign holders of U.S. Treasury securities" subtitle="Monthly, about a six-week lag." help="Holdings are reported by where the securities are held (custody), so financial centers such as Belgium, Luxembourg and the Cayman Islands hold securities for investors elsewhere. Figures are market values, so a rate rise alone lowers holdings, and the change from a year ago mixes price moves with net buying or selling.">
                    <TicHolders data={tic} />
                  </PulsePanel>
                )}
                <PulseMarketStrip tiles={tilesIn('Rates & dollar')} />
                <PulsePanel title="Who moved most" subtitle="30-day change against the dollar." help="Ranks these currencies by how much they changed against the dollar over the last 30 days.">
                  <PulseCurrencyMovers rows={markets?.currencies ?? []} />
                </PulsePanel>
                {seeAll('More on money and the dollar', 'money')}
              </section>

              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">Military and alliances</h3>
                {loading ? (
                  loadingBlock
                ) : (
                  <InfluenceBlocs breakdown={summary?.countryBreakdown ?? []} activeCountry={activeCountry} onSelect={setActiveCountry} />
                )}
                {Object.keys(natoDefense).length > 0 && (
                  <PulsePanel title="NATO defense spending, % of GDP" subtitle={`${Object.keys(natoDefense).length} of ${NATO_MEMBER_COUNT} allies shown; NATO's own estimates, not a live feed.`} help="Source: NATO, 'Defence Expenditure of NATO Countries (2014-2025),' published 28 August 2025. 2024 and 2025 figures are estimates. Only some allies are stored, and each bar shows its own latest year.">
                    <NatoSpendingBars countries={natoDefense} active={activeCountry} onSelect={setActiveCountry} />
                  </PulsePanel>
                )}
                {seeAll('More on military and alliances', 'military')}
              </section>

              <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
                Hard power is what a state can compel or withhold: sanctions, tariffs, export controls, the dollar and defense. This page tracks the U.S. toolkit only: other countries' instruments, such as China's export controls on rare earths and its Unreliable Entity List, are not shown, so it is not a two-sided comparison of coercive tools. Most of these figures come from the same feeds as the{' '}
                <Link to="/" className="text-accent hover:underline">
                  {SITE.name} front page
                </Link>
                . For attraction rather than coercion, see{' '}
                <Link to="/soft-power" className="text-accent hover:underline">
                  Soft Power
                </Link>
                .
              </p>
            </div>
          )}

          {tab === 'trade' && (
            <div className="flex flex-col gap-4">
              <SectionHeader tone="hard" title="Trade tools" description="
                  Tariffs, sanctions and export controls: the tools the U.S. is actively using to raise costs or cut off access, as published in the Federal
                  Register. U.S. tools only; other countries' instruments are not shown.
                " />
              <PulsePanel
                title="Where measures converge"
                subtitle="Countries named by several different kinds of source at once, last 60 days"
                help="Measures rarely come from one direction. This ranks countries by how many kinds of source (U.S. actions, news, sanctions or export listings, forced-labor orders) name them, then by how many topics. It is a count of what was published, not a risk score. Open a country to see its full timeline."
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
                    title="Rate under the 2026 forced-labor Section 301 action"
                    help="The extra duty each economy faces under the July 2026 Section 301 forced-labor action, as collected today. It is not a country's total U.S. tariff: the 2018-onward Section 301 duties on China, Section 232 product duties and antidumping/countervailing duties are not in this figure, so a country can face far more than the rate shown."
                    subtitle="One action only. China's 2018-onward Section 301 duties and other measures are not in this figure."
                  >
                    {loading || !summary ? (
                      loadingBlock
                    ) : (
                      <PulseCountryTariffs tariffs={summary.countryTariffs} activeCountry={activeCountry} onSelect={setActiveCountry} />
                    )}
                  </PulsePanel>
                </div>
                <div className="min-w-0 lg:col-span-8">
                  <PulsePanel
                    title="Active measures"
                    help="Extra taxes on imports the U.S. currently charges under specific laws: an ongoing measure, not a one-time announcement."
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
                    title="Pace of U.S. trade actions"
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
              <PulsePanel
                title="Tariff programs, every row"
                help="Every row in this app's tariff_overlays table: one per (program, HTS pattern, country). Active measures above groups these into one row per real-world measure; this is the full underlying data."
              >
                <PulseTariffBrowser />
              </PulsePanel>
              <PulsePanel title="Commerce Country Chart, full curation" help="Every destination this app has hand-verified export-control status for, and an honest count of how many it hasn't.">
                <PulseExportChart />
              </PulsePanel>
              {seeAll(`Latest notices on ${SITE.name}`, 'overview')}
            </div>
          )}

          {tab === 'sanctions' && (
            <div className="flex flex-col gap-4">
              <SectionHeader tone="hard" title="Sanctions" description="
                  Browse OFAC's Specially Designated Nationals list and the Commerce/State Consolidated Screening List by country. Filtering by country is a
                  text match on each entry's address field, not a normalized code. See the note below the search box. OFAC sanctions and Commerce/State export-control listings are different kinds of measure and are counted separately.
                " />
              <PulsePanel title="Recently listed" help="Parties added to the UN Security Council, UK and U.S. Commerce/State lists in the last 30 days, by each list's own listing date. Only parties whose address or nationality names a country appear.">
                <RecentListings />
              </PulsePanel>
              <PulsePanel
                title="Countries named most often"
                subtitle="Listed parties whose address names the country (a text match, not a legal finding)."
                help="Counts of listings on the OFAC SDN, Commerce/State (export-control and related), UN and UK lists whose listed address names each country, shown per list. A party on several lists counts once on each list. A count says how many parties are listed, not how severe the measures are, and the match is on address text, not a legal finding."
              >
                <SanctionsLeaders selected={sanctionsCountry} onPick={setSanctionsCountry} />
              </PulsePanel>
              <PulsePanel title="Sanctioned entities" help="These are the same two lists the compliance calculator screens party names against. This view lets you browse them directly by country instead of one name at a time.">
                <PulseSanctionsBrowser key={sanctionsCountry} initialCountry={sanctionsCountry || (params.get('country') ?? '')} />
              </PulsePanel>
            </div>
          )}

          {tab === 'money' && (
            <div className="flex flex-col gap-8">
              <SectionHeader tone="hard" title="Money and the dollar" description="
                  The dollar's pull as the world's reserve currency, who holds U.S. debt, and its reach in world markets. A measure of financial leverage, not of
                  favorability.
                " />

              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">The dollar's reserve-currency share</h3>
                <PulsePanel
                  title="Percent of world FX reserves held in U.S. dollars"
                  help="IMF COFER: the currency composition of official foreign-exchange reserves, reported by central banks worldwide, valued at current exchange rates. Part of any move is valuation (a falling dollar shrinks the dollar share with no selling), so it is not a clean read on central-bank confidence, and it is not a prediction about what replaces the dollar. The euro and renminbi lines are drawn when available."
                  subtitle={`Quarterly since 1999, latest ${coferLatest ? quarterLabel(coferLatest.date) : ''}.`}
                >
                  {coferPoints.length === 0 ? (
                    loadingBlock
                  ) : (
                    <>
                      <PowerCoferChart points={coferPoints} eur={coferEur} cny={coferCny} />
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            const eur = new Map(coferEur.map(([d, v]) => [d, v]));
                            const cny = new Map(coferCny.map(([d, v]) => [d, v]));
                            downloadCsv(
                              'aex-terminal-imf-cofer-reserve-shares.csv',
                              ['quarter_end', 'quarter', 'usd_share_pct', 'eur_share_pct', 'cny_share_pct', 'unit', 'source', 'source_url'],
                              coferPoints.map(([d, v]) => [d, quarterLabel(d), v, eur.get(d) ?? '', cny.get(d) ?? '', 'percent of allocated reserves', 'IMF COFER', 'https://data.imf.org'])
                            );
                          }}
                          className="text-xs font-semibold text-ink-faint underline hover:text-ink"
                        >
                          Download CSV
                        </button>
                        <CiteThisButton
                          chartType="cofer"
                          title="U.S. dollar's share of world FX reserves"
                          params={{}}
                          data={{ points: coferPoints }}
                          sourceNote="International Monetary Fund, COFER (data.imf.org), quarterly, share of allocated reserves."
                        />
                      </div>
                    </>
                  )}
                </PulsePanel>
              </section>

              {tic && tic.countries.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h3 className="font-display text-xl font-bold text-ink">Who holds U.S. debt</h3>
                  <PulsePanel
                    title="Largest foreign holders of U.S. Treasury securities"
                    help="The Treasury's monthly survey of who owns U.S. government debt. Holdings are reported by where the securities are held, so financial centers such as Belgium, Luxembourg and the Cayman Islands can hold securities on behalf of investors elsewhere, which understates the true owners (China's holdings are larger than its own row). Figures are market values, so a rate rise alone lowers holdings, and the change from a year ago mixes price moves with net buying or selling."
                    subtitle="Monthly, about a six-week lag."
                  >
                    <TicHolders data={tic} />
                  </PulsePanel>
                </section>
              )}

              {marketsFailed && !markets && <p className="text-sm text-ink-faint">Couldn't load market data right now.</p>}
              <section className="flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold text-ink">The dollar's market reach</h3>
                <PulseMarketStrip tiles={tilesIn('Rates & dollar')} />
                {tilesIn('World stocks').length > 0 && <PulseMarketStrip tiles={tilesIn('World stocks')} />}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PulsePanel
                    title="U.S. dollar vs. trade partners"
                    help="How many units of each currency one U.S. dollar buys (for example, euros per dollar). A rising number means the dollar buys more of that currency. Some currencies are pegged to the dollar, so their moves are small by design."
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

              {power.some((i) => !isDefense(i.id)) && (
                <IndicatorExplorer
                  tone="hard"
                  heading="Economic weight and exposure"
                  blurb="Size, trade, investment and high-technology exports: what a country can pay for, buy or withhold, and how exposed it is to others. These are context, not coercive capacity: some measures (foreign investment received, licence payments, trade openness) show dependence rather than power. Figures are in current U.S. dollars at market exchange rates (no purchasing-power adjustment), and each row shows its own year. Pick a measure to see economies ranked."
                  indicators={power.filter((i) => !isDefense(i.id))}
                />
              )}
              {power.filter((i) => i.endedYear).map((i) => (
                <p key={i.id} className="border border-hairline-strong bg-paper-raised px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
                  <span className="font-semibold text-ink">{i.label}: series ended in {i.endedYear}.</span> The World Bank has published nothing newer, so this measure is not ranked here (the last figures are a pandemic-year snapshot, not a current standing).
                </p>
              ))}

              <p className="text-xs leading-relaxed text-ink-faint">
                Reserve-share data is the IMF's COFER series, published quarterly with roughly a one-quarter lag, at current exchange rates. Currency rates are the ECB's daily reference rates,
                published once per business day.
              </p>
            </div>
          )}

          {tab === 'military' && (
            <div className="flex flex-col gap-4">
              <SectionHeader tone="hard" title="Military and alliances" description="
                  Formal, public membership in five real groupings, cross-referenced with this month's real country breakdown, and NATO's own defense-spending
                  estimates. See the Guide tab for sources and limits.
                " />
              {loading ? (
                loadingBlock
              ) : (
                <InfluenceBlocs breakdown={summary?.countryBreakdown ?? []} activeCountry={activeCountry} onSelect={setActiveCountry} />
              )}

              {Object.keys(natoDefense).length > 0 && (
                <PulsePanel
                  title="NATO defense spending, % of GDP"
                  subtitle={`${Object.keys(natoDefense).length} of ${NATO_MEMBER_COUNT} allies shown; NATO's own estimates, not a live feed, re-verified by hand roughly once a year.`}
                  help="Source: NATO, 'Defence Expenditure of NATO Countries (2014-2025),' published 28 August 2025. 2024 and 2025 figures are NATO's own estimates, not final. Only some allies are stored here, so this is not the whole alliance; each bar shows its own latest year (Germany's is 2024 because NATO left its 2025 estimate blank). The United States is shown as the baseline. The older target is 2% of GDP on core defense; in 2025 allies agreed to 5% by 2035, split 3.5% core and 1.5% related. NATO's definition differs from the World Bank/SIPRI series in the military explorer below, so the same country can show two slightly different figures (for example the U.S.: 3.22% NATO 2025e, about 3.1% SIPRI)."
                >
                  <NatoSpendingBars countries={natoDefense} active={activeCountry} onSelect={setActiveCountry} />
                </PulsePanel>
              )}

              {power.some((i) => isDefense(i.id)) && (
                <IndicatorExplorer tone="hard" heading="Military spending, every country" blurb="What each government spends on its armed forces, in dollars and as a share of its economy." indicators={power.filter((i) => isDefense(i.id))} />
              )}

              {activeCountry && (
                <p className="text-sm text-ink-muted">
                  Selected: <span className="text-ink">{COUNTRY_LABELS[activeCountry] ?? activeCountry}</span>. See its{' '}
                  <Link to={`/country/${activeCountry}`} className="text-accent hover:underline">
                    full country page
                  </Link>
                  , or{' '}
                  <button type="button" onClick={() => setTab('overview', true)} className="text-accent hover:underline">
                    scroll up
                  </button>
                  .
                </p>
              )}
            </div>
          )}

          {tab === 'compare' && <CountryCompare view="trade" embedded />}

          {tab === 'guide' && <HardPowerGuide />}
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
