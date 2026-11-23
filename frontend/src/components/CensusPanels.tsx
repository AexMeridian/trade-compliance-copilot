import { useEffect, useState } from 'react';
import { getCensusCompare, getCensusTariffRate, getForeignBorn, type CensusCompare, type CensusTariffRate, type CensusTrailing, type ForeignBorn } from '../lib/api';
import { PulsePanel } from './PulsePanel';
import { TrendChart, type ChartEvent, type ChartLine } from './TrendChart';
import { ChartFooter } from './ChartFooter';
import { ProvenanceBadge } from './ProvenanceBadge';

// Census Bureau data (needs the site's free Census key on the server). Until the key is set the server answers "needs_key" and every
// panel here says the figures are not available yet instead of showing an empty chart.

const yearFrac = (ym: string) => Number(ym.slice(0, 4)) + (Number(ym.slice(5, 7)) - 1) / 12;
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const usd = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e12 ? `$${(a / 1e12).toFixed(2)} trillion` : a >= 1e9 ? `$${(a / 1e9).toFixed(1)} billion` : `$${(a / 1e6).toFixed(0)} million`;
  return v < 0 ? `-${s}` : s;
};
const PARTNER_COLORS = ['var(--color-hue-orange-ink)', 'var(--color-hue-violet-ink)', 'var(--color-hue-pink-ink)', 'var(--color-hue-cyan-ink)', 'var(--color-hue-gray-ink)'];

function NotYet() {
  return <p className="text-sm text-ink-faint">These Census Bureau figures are not loaded on this site yet. They will appear here once the data feed is switched on.</p>;
}

const census = (asOf: string | null, url: string, updatedAt?: string | null) => ({
  source_url: url,
  source_tier: 1 as const,
  last_updated: (updatedAt ?? '').slice(0, 10),
  data_as_of: asOf ?? undefined,
});

// The effective tariff rate: duties Census calculated on imports, divided by the value of imports, with the big tariff dates marked.
export function EffectiveTariffRate({ partnerCodes = false }: { partnerCodes?: boolean } = {}) {
  const [data, setData] = useState<CensusTariffRate | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => {
    getCensusTariffRate().then(setData).catch(() => setFailed(true));
  }, []);

  const rate = (p: [string, number | null, number | null, number | null]) => (p[1] && p[1] > 0 && p[2] !== null ? ([yearFrac(p[0]), (p[2] / p[1]) * 100] as [number, number]) : null);
  const totalPts = (data?.total ?? []).map(rate).filter((p): p is [number, number] => p !== null);
  const steel = data?.tariffDates.find((t) => t.program === 'sec232_steel');
  const autos = data?.tariffDates.find((t) => t.program === 'sec232_autos');
  const events: ChartEvent[] = [
    { date: '2018-03-23', label: 'Steel tariff begins (25%)' },
    ...(steel && steel.since > '2018-12-31' ? [{ date: steel.since, label: `Steel rate now ${steel.rate ?? '?'}%` }] : []),
    ...(autos ? [{ date: autos.since, label: `Car tariff ${autos.rate ?? '?'}%` }] : []),
  ];
  const lines: ChartLine[] = [{ id: 'all', label: 'All imports', color: 'var(--color-hue-blue-ink)', points: totalPts }];
  (data?.partners ?? []).filter((p) => shown.includes(p.code)).forEach((p, i) => {
    lines.push({ id: p.code, label: p.name.replace(/^(\w)(.*)$/, (_m, a: string, b: string) => a + b.toLowerCase()), color: PARTNER_COLORS[i % PARTNER_COLORS.length], points: p.points.map(rate).filter((x): x is [number, number] => x !== null) });
  });
  const t = data?.trailing12;

  return (
    <PulsePanel
      title="The average tariff rate on U.S. imports"
      subtitle="Duties Census calculated on goods entering the country, divided by the value of those goods, each month."
      help="Most imports enter with no tariff or a small one, so the average is far lower than the headline rate on any one product. It rises when tariffs are added and when importers move toward goods that carry them. It uses Census's calculated duty, which can differ from the cash the Treasury collects in a month."
    >
      {failed && <p className="text-sm text-stop">Could not load the tariff-rate data right now.</p>}
      {!data && !failed && <p className="text-sm text-ink-faint">Loading…</p>}
      {data && data.status !== 'ok' && <NotYet />}
      {data && data.status === 'ok' && (
        <>
          {t?.effectiveRatePct != null && (
            <p className="mb-3 border-l-4 border-accent pl-3 text-base text-ink">
              Over the 12 months to {monthLabel(t.asOf)} the average rate was <span className="font-semibold tabular-nums">{t.effectiveRatePct.toFixed(1)}%</span>: {usd(t.duties)} in duties on {usd(t.imports)} of imports.
            </p>
          )}
          {partnerCodes && data.partners.length > 0 && (
            <fieldset className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <legend className="mb-1 text-xs text-ink-faint">Add a trading partner to the chart</legend>
              {data.partners.slice(0, 5).map((p) => (
                <label key={p.code} className="flex items-center gap-1.5 text-ink-muted">
                  <input type="checkbox" checked={shown.includes(p.code)} onChange={(e) => setShown((s) => (e.target.checked ? [...s, p.code] : s.filter((c) => c !== p.code)))} />
                  {p.name.charAt(0) + p.name.slice(1).toLowerCase()}
                </label>
              ))}
            </fieldset>
          )}
          <TrendChart lines={lines} format={(v) => `${v.toFixed(1)}%`} events={events} min={0} ariaLabel="Average tariff rate on U.S. imports by month (calculated duties divided by imports), with tariff dates marked." />
          {data.note && <p className="mt-3 text-sm text-ink-muted">{data.note}</p>}
          <div className="mt-3">
            <ProvenanceBadge source={census(data.asOf, data.sourceUrl, data.updatedAt)} />
          </div>
          <ChartFooter
            source="U.S. Census Bureau, international trade data (imports for consumption and calculated duties)"
            sourceUrl={data.sourceUrl}
            asOf={data.asOf ?? undefined}
            csv={{
              filename: 'aex-terminal-effective-tariff-rate.csv',
              header: ['month', 'imports_usd', 'calculated_duties_usd', 'effective_rate_pct', 'source'],
              rows: data.total.map(([m, i, d]) => [m, i ?? '', d ?? '', i && d !== null ? ((d / i) * 100).toFixed(2) : '', 'U.S. Census Bureau']),
            }}
          />
        </>
      )}
    </PulsePanel>
  );
}

// Imports, exports, balance and share of U.S. imports for the countries in the Compare view, one block per country.
export function useCensusCompare(codes: string[]): CensusCompare | null {
  const [data, setData] = useState<CensusCompare | null>(null);
  const key = codes.join(',');
  useEffect(() => {
    let live = true;
    getCensusCompare(codes).then((d) => live && setData(d)).catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

export function TradeWithUs({ stats, asOf, sourceUrl, status }: { stats: CensusTrailing | null | undefined; asOf: string | null; sourceUrl: string; status: string }) {
  if (status !== 'ok') return <p className="mt-1 text-ink-faint">Not available yet.</p>;
  if (!stats) return <p className="mt-1 text-ink-faint">No trade recorded with the United States in this period.</p>;
  return (
    <>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-ink-muted">
        <dt>U.S. imports from here</dt>
        <dd className="text-right tabular-nums text-ink">{usd(stats.imports)}</dd>
        <dt>U.S. exports to here</dt>
        <dd className="text-right tabular-nums text-ink">{usd(stats.exports)}</dd>
        <dt>U.S. balance</dt>
        <dd className="text-right tabular-nums text-ink">{stats.balance < 0 ? `${usd(-stats.balance)} deficit` : `${usd(stats.balance)} surplus`}</dd>
        <dt>Share of all U.S. imports</dt>
        <dd className="text-right tabular-nums text-ink">{stats.shareOfUsImportsPct === null ? 'n/a' : `${stats.shareOfUsImportsPct.toFixed(1)}%`}</dd>
        <dt>Average tariff rate</dt>
        <dd className="text-right tabular-nums text-ink">{stats.effectiveRatePct === null ? 'n/a' : `${stats.effectiveRatePct.toFixed(1)}%`}</dd>
      </dl>
      <p className="mt-1 text-xs text-ink-faint">12 months to {monthLabel(stats.asOf)}.</p>
      <div className="mt-1.5">
        <ProvenanceBadge source={census(asOf, sourceUrl)} />
      </div>
    </>
  );
}

// For country pages: how many people born in this country live in the U.S., and where (American Community Survey).
export function ForeignBornPanel({ code, name }: { code: string; name: string }) {
  const [data, setData] = useState<ForeignBorn | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getForeignBorn(code).then((d) => live && setData(d)).catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [code]);
  if (code === 'US' || failed) return null;
  // No data yet (the key is not set): keep country pages free of an empty box.
  if (!data || data.national === null) return null;
  const max = Math.max(...data.states.map((s) => s.estimate), 1);
  return (
    <PulsePanel
      title={`People born in ${name} living in the U.S.`}
      subtitle={`${data.national.toLocaleString('en-US')} people (${data.year}), and the states where most live.`}
      help={data.note}
    >
      <ul className="flex flex-col gap-1 text-sm">
        {data.states.slice(0, 8).map((s) => (
          <li key={s.state} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate text-ink-muted">{s.state}</span>
            <span className="h-2 bg-accent" style={{ width: `${Math.max(2, (s.estimate / max) * 55)}%` }} aria-hidden="true" />
            <span className="tabular-nums text-ink">{s.estimate.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <ProvenanceBadge source={{ source_url: data.sourceUrl, source_tier: 1, last_updated: '', data_as_of: String(data.year) }} />
      </div>
      <ChartFooter
        source="U.S. Census Bureau, American Community Survey 1-year estimates (table B05006)"
        sourceUrl={data.sourceUrl}
        asOf={String(data.year)}
        csv={{ filename: `aex-terminal-foreign-born-${code}.csv`, header: ['state', 'people_born_here', 'year', 'source'], rows: data.states.map((s) => [s.state, s.estimate, data.year, 'ACS B05006']) }}
      />
    </PulsePanel>
  );
}
