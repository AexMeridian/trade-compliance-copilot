import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Skeleton } from '../components/Skeleton';
import { ECONOMY_PANELS, EconomySection } from '../components/dashboard/EconomyPanels';
import { Directory } from '../components/dashboard/Directory';
import { POWER_PANELS, PowerSection, TRADE_PANELS, TradeSection } from '../components/dashboard/PowerPanels';
import { WORLD_PANELS, WorldSection } from '../components/dashboard/WorldPanels';
import { KeyNumbers } from '../components/dashboard/KeyNumbers';
import { getDashboardEconomy, getDashboardPower, getDashboardWorld, getToday, type DashKeyNumber, type EconomyData, type PowerDashData, type TodayData, type WorldDashData } from '../lib/api';
import { CountryPicker, ago, useChosenCountries } from './Today';

// The Dashboard: one screen for "what is going on right now". A strip of key numbers, then sections you can switch between. Each section
// is loaded on its own, so a slow or missing source never blanks the page. Everything names its source and date; nothing here is advice.

const TABS = [
  { id: 'economy', label: 'Markets and economy' },
  { id: 'trade', label: 'Trade and tariffs' },
  { id: 'power', label: 'Power and security' },
  { id: 'world', label: 'People, politics and the world' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const HIDE_KEY = 'dash-hidden';
const readHidden = (): string[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(HIDE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Key numbers that come from the "today" data rather than the economy section. */
function todayKeyNumbers(t: TodayData | null): DashKeyNumber[] {
  if (!t) return [];
  const out: DashKeyNumber[] = [];
  if (t.trade) out.push({ id: 'notices', label: 'New U.S. trade notices (7 days)', value: String(t.trade.data.last7), change: t.trade.data.last30 ? `${t.trade.data.last30} in 30 days` : null, direction: null, asOf: t.trade.asOf, points: [], href: '#trade', section: 'world' });
  if (t.sanctions?.data) out.push({ id: 'sanctions', label: 'Sanctions list changes', value: `+${t.sanctions.data.added} / −${t.sanctions.data.removed}`, change: `added / removed on ${t.sanctions.data.date}`, direction: null, asOf: t.sanctions.asOf, points: [], href: '#sanctions', section: 'world' });
  if (t.travel) out.push({ id: 'travel', label: '"Do not travel" countries', value: String(t.travel.data.level4Count), change: 'State Department Level 4', direction: null, asOf: t.travel.asOf, points: [], href: '#travel', section: 'world' });
  return out;
}

function powerKeyNumbers(p: PowerDashData | null): DashKeyNumber[] {
  if (!p) return [];
  const out: DashKeyNumber[] = [];
  if (p.nato) out.push({ id: 'nato', label: 'NATO allies at 2% of economy or more', value: `${p.nato.metTarget} of ${p.nato.rows.length}`, change: 'allies shown', direction: null, asOf: p.nato.asOf, points: [], href: '#nato', section: 'power' });
  if (p.sanctions) out.push({ id: 'sanctioned', label: 'Names on sanctions lists', value: p.sanctions.total.toLocaleString('en-US'), change: 'U.S., UN and UK lists', direction: null, asOf: null, points: [], href: '#sanctions', section: 'power' });
  return out;
}

const PANELS_FOR: Record<string, { id: string; label: string }[]> = { economy: ECONOMY_PANELS, trade: TRADE_PANELS, power: POWER_PANELS, world: WORLD_PANELS };

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'economy') as TabId;
  const [economy, setEconomy] = useState<EconomyData | null>(null);
  const [economyFailed, setEconomyFailed] = useState(false);
  const [power, setPower] = useState<PowerDashData | null>(null);
  const [powerFailed, setPowerFailed] = useState(false);
  const [world, setWorld] = useState<WorldDashData | null>(null);
  const [worldFailed, setWorldFailed] = useState(false);
  const [today, setToday] = useState<TodayData | null>(null);
  const [todayFailed, setTodayFailed] = useState(false);
  const [chosen, changeChosen] = useChosenCountries();
  const [hidden, setHidden] = useState<string[]>(readHidden);

  useEffect(() => {
    let off = false;
    getDashboardEconomy().then((d) => !off && (Array.isArray(d?.keyNumbers) ? setEconomy(d) : setEconomyFailed(true))).catch(() => !off && setEconomyFailed(true));
    getDashboardPower().then((d) => !off && (Array.isArray(d?.usChina) ? setPower(d) : setPowerFailed(true))).catch(() => !off && setPowerFailed(true));
    getDashboardWorld().then((d) => !off && (Array.isArray(d?.upcoming) ? setWorld(d) : setWorldFailed(true))).catch(() => !off && setWorldFailed(true));
    getToday().then((d) => !off && (Array.isArray(d?.sentences) ? setToday(d) : setTodayFailed(true))).catch(() => !off && setTodayFailed(true));
    return () => {
      off = true;
    };
  }, []);

  const keyNumbers = useMemo(() => [...(economy?.keyNumbers ?? []), ...todayKeyNumbers(today), ...powerKeyNumbers(power)], [economy, today, power]);
  const show = (id: string) => !hidden.includes(id);
  const stamp = economy?.asOf ?? today?.asOf ?? null;

  function setTab(next: TabId) {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('tab', next);
      return n;
    }, { replace: true });
  }
  function jump(k: DashKeyNumber) {
    if (k.section !== tab) setTab(k.section as TabId);
    window.setTimeout(() => document.getElementById(k.href.replace('#', ''))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  function toggle(id: string) {
    const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    setHidden(next);
    try {
      window.localStorage.setItem(HIDE_KEY, JSON.stringify(next));
    } catch {
      /* private window: not remembered */
    }
  }

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="display text-3xl leading-tight text-ink sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {now}
            {stamp ? ` · updated ${ago(stamp)}` : ''}
          </p>
        </div>
        <CountryPicker chosen={chosen} onChange={changeChosen} />
      </header>
      <p className="mt-2 max-w-3xl text-sm leading-snug text-ink-muted">What is going on in the economy, trade, politics and the world, in plain words. Every number names its source and date, and nothing here is advice.</p>

      <div className="mt-5">
        {keyNumbers.length > 0 ? (
          <KeyNumbers items={keyNumbers} onOpen={jump} />
        ) : !economyFailed && !todayFailed ? (
          <div aria-busy="true">
            <Skeleton rows={3} className="text-ink" />
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-hairline">
        <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {PANELS_FOR[tab] && (
          <details className="relative pb-1 text-sm">
            <summary className="cursor-pointer font-semibold text-ink-muted">Choose panels</summary>
            <fieldset className="absolute right-0 z-10 mt-1 w-64 border border-hairline-strong bg-paper-raised p-3 shadow-lg">
              <legend className="sr-only">Panels to show</legend>
              {PANELS_FOR[tab].map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-1 text-ink">
                  <input type="checkbox" checked={show(p.id)} onChange={() => toggle(p.id)} />
                  {p.label}
                </label>
              ))}
            </fieldset>
          </details>
        )}
      </div>

      <div role="tabpanel" className="mt-5 min-h-[480px]">
        {tab === 'economy' && (
          <>
            {economy ? <EconomySection data={economy} show={show} /> : economyFailed ? <Unavailable /> : <Skeleton rows={10} className="text-ink" />}
            {economy && economy.summary.length > 0 && <p className="mt-4 text-[13px] text-ink-faint">{economy.summary.join(' ')}</p>}
          </>
        )}
        {tab === 'trade' && (power ? <TradeSection data={power} show={show} /> : powerFailed ? <Unavailable /> : <Skeleton rows={10} className="text-ink" />)}
        {tab === 'power' && (power ? <PowerSection data={power} show={show} /> : powerFailed ? <Unavailable /> : <Skeleton rows={10} className="text-ink" />)}
        {tab === 'world' && (world || today ? <WorldSection world={world} today={today} chosen={chosen} show={show} /> : worldFailed && todayFailed ? <Unavailable /> : <Skeleton rows={10} className="text-ink" />)}
      </div>

      <Directory />

      <p className="mt-8 text-[13px] leading-snug text-ink-faint">
        The Dashboard summarizes public data and is refreshed through the day. See{' '}
        <Link to="/methodology" className="underline">
          the sources and methods
        </Link>
        .
      </p>
    </div>
  );
}

function Unavailable() {
  return (
    <p role="alert" className="text-ink-muted">
      This section could not be loaded. Try again in a few minutes.
    </p>
  );
}
