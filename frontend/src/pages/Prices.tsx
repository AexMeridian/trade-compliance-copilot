import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PulsePanel } from '../components/PulsePanel';
import { Sparkline } from '../components/Sparkline';
import { TrendChart, type ChartEvent, type ChartLine } from '../components/TrendChart';
import { ChartFooter } from '../components/ChartFooter';
import { EffectiveTariffRate } from '../components/CensusPanels';
import { FreightPanel } from '../components/FreightPanel';
import { getEveryday, type EverydayResponse, type EverydaySeries } from '../lib/api';

// "Tariffs and your wallet": the question ordinary visitors in user testing came with ("are tariffs making my groceries, medicine,
// washer or car cost more? are they saving steel jobs?"). Official price and jobs series, the duties actually collected, and the tariff
// dates from this site's own table. It shows what happened next to when tariffs changed; it does not claim one caused the other.

const yearFrac = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.getUTCFullYear() + d.getUTCMonth() / 12;
};
const monthName = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const usdB = (v: number) => `$${(v / 1e9).toFixed(1)}B`;

// Where to read more about tariffs on each kind of good: a search of the official notices this site collects, not a claim about prices.
const RELATED: Record<string, { q: string; hint: string }> = {
  'BLS:CPI_FOOD_HOME': { q: 'food', hint: 'notices that mention food' },
  'BLS:CPI_RX': { q: 'pharmaceutical', hint: 'notices on medicines' },
  'BLS:CPI_APPLIANCES': { q: 'appliances', hint: 'notices on appliances' },
  'BLS:CPI_FURNITURE': { q: 'furniture', hint: 'notices on furniture' },
  'BLS:CPI_NEW_CARS': { q: 'automobile', hint: 'Section 232 auto notices' },
  'BLS:CPI_USED_CARS': { q: 'automobile', hint: 'Section 232 auto notices' },
  'BLS:CPI_APPAREL': { q: 'apparel', hint: 'notices on clothing' },
  'BLS:CPI_TOYS': { q: 'toys', hint: 'notices on toys' },
  'BLS:CPI_COFFEE': { q: 'coffee', hint: 'notices on coffee' },
  'BLS:CPI_GASOLINE': { q: 'petroleum', hint: 'notices on oil' },
};

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-ink-faint">no year-ago reading</span>;
  const word = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'about flat';
  return (
    <span className={pct > 0.05 ? 'text-stop' : pct < -0.05 ? 'text-clear' : 'text-ink-muted'}>
      {word}
      {word !== 'about flat' ? ` ${Math.abs(pct).toFixed(1)}%` : ''} from a year ago
    </span>
  );
}

function PriceTile({ s }: { s: EverydaySeries }) {
  const pts = s.points.slice(-60).map(([d, v]) => [yearFrac(d), v] as [number, number]);
  const rel = RELATED[s.id];
  return (
    <div className="border border-hairline bg-paper-raised px-4 py-3">
      <p className="text-[15px] font-semibold text-ink">{s.label}</p>
      <p className="mt-1 text-lg tabular-nums">
        <Change pct={s.yoyPct} />
      </p>
      {pts.length > 2 && (
        <div className="mt-2" aria-hidden="true">
          <Sparkline points={pts} color="var(--color-hue-orange-ink)" width={220} height={36} />
        </div>
      )}
      <p className="mt-1 text-xs text-ink-faint">
        {s.latest ? `Latest: ${monthName(s.latest[0])}. ` : ''}Last 5 years.
        {rel && (
          <>
            {' '}
            <Link to={`/?tab=policy&q=${encodeURIComponent(rel.q)}`} className="text-accent hover:underline">
              Read {rel.hint}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function Prices() {
  const [data, setData] = useState<EverydayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getEveryday().then(setData).catch(() => setFailed(true));
  }, []);

  const steel = data?.tariffDates.find((t) => t.program === 'sec232_steel');
  const autos = data?.tariffDates.find((t) => t.program === 'sec232_autos');
  const events: ChartEvent[] = [
    // The first Section 232 steel tariff (Proclamation 9705) took effect on 23 March 2018.
    { date: '2018-03-23', label: 'Steel tariff begins (25%)' },
    ...(steel && steel.since > '2018-12-31' ? [{ date: steel.since, label: `Steel rate now ${steel.rate ?? '?'}%` }] : []),
    ...(autos ? [{ date: autos.since, label: `Car tariff ${autos.rate ?? '?'}%` }] : []),
  ];
  const JOB_COLORS = ['var(--color-hue-blue-ink)', 'var(--color-hue-orange-ink)', 'var(--color-hue-violet-ink)'];
  const jobLines: ChartLine[] = (data?.jobs ?? [])
    .filter((s) => s.id !== 'BLS:JOBS_MFG' && s.points.length > 1)
    .map((s, i) => ({ id: s.id, label: s.label, color: JOB_COLORS[i % JOB_COLORS.length], points: s.points.map(([d, v]) => [yearFrac(d), v] as [number, number]) }));
  const gross = data?.customs.gross;
  const net = data?.customs.net;
  const customsLines: ChartLine[] = [
    ...(gross && gross.points.length > 1 ? [{ id: 'gross', label: 'Collected', color: 'var(--color-hue-blue-ink)', points: gross.points.map(([d, v]) => [yearFrac(d), v / 1e9] as [number, number]) }] : []),
    ...(net && net.points.length > 1 ? [{ id: 'net', label: 'After refunds', color: 'var(--color-hue-orange-ink)', points: net.points.map(([d, v]) => [yearFrac(d), v / 1e9] as [number, number]), dashed: true }] : []),
  ];
  const all = data?.prices.find((p) => p.id === 'BLS:CPI');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumb trail={[{ label: 'Basics', to: '/basics' }, { label: 'Tariffs and your wallet' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">Tariffs and your wallet</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
        A tariff is a tax on goods brought into the country. The importing company pays it to U.S. Customs, and some or all of that cost can be passed on
        in the price you pay. Below are the official price changes for things people buy, the jobs in industries tariffs are meant to protect, and how
        much the tariffs collect. They show what happened, not why: prices also move with wages, fuel, interest rates and demand.
      </p>
      {all?.yoyPct != null && (
        <p className="mt-4 max-w-2xl border-l-4 border-accent pl-3 text-lg text-ink">
          Overall, consumer prices are <Change pct={all.yoyPct} /> ({all.latest ? monthName(all.latest[0]) : ''}).
        </p>
      )}
      {failed && <p className="mt-6 text-sm text-stop">Could not load the price data right now. Please try again later.</p>}
      {!data && !failed && <p className="mt-6 text-sm text-ink-faint">Loading…</p>}

      {data && (
        <div className="mt-8 flex flex-col gap-8">
          <PulsePanel title="Prices of everyday things" subtitle="Change in the price over the last 12 months, from the Consumer Price Index.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.prices
                .filter((p) => p.id !== 'BLS:CPI' && p.points.length > 0)
                .map((p) => (
                  <PriceTile key={p.id} s={p} />
                ))}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              "Prices of imported goods" is the government's import price index: what U.S. buyers pay foreign sellers, before the tariff. If the tariff were
              absorbed by foreign sellers this would fall; if it rises or holds while store prices rise, the cost is being paid here.
            </p>
            <ChartFooter
              source="U.S. Bureau of Labor Statistics (Consumer Price Index, Import Price Index)"
              sourceUrl="https://www.bls.gov/cpi/"
              asOf={data.prices.find((p) => p.latest)?.latest?.[0].slice(0, 7)}
              csv={{
                filename: 'aex-terminal-everyday-prices.csv',
                header: ['series_id', 'label', 'month', 'index_value', 'source'],
                rows: data.prices.flatMap((p) => p.points.map(([d, v]) => [p.id, p.label, d.slice(0, 7), v, 'BLS'])),
              }}
            />
          </PulsePanel>

          <PulsePanel
            title="Jobs in steel, metal products and cars"
            subtitle="Workers employed each month, in thousands, with the tariff dates marked."
            help="From the Bureau of Labor Statistics' monthly employment survey (seasonally adjusted). Steel tariffs protect steel mills but raise costs for industries that buy steel, such as metal fabricators and carmakers, so the lines are shown together. Jobs also follow demand, interest rates and automation."
          >
            {jobLines.length > 0 ? (
              <TrendChart lines={jobLines} format={(v) => `${Math.round(v)}k`} events={events} ariaLabel="Monthly employment in iron and steel mills, fabricated metal products, and motor vehicles and parts, with tariff dates marked." />
            ) : (
              <p className="text-sm text-ink-faint">The jobs series is still loading into this site; it refreshes daily.</p>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {data.jobs.map((s) => (
                <p key={s.id} className="text-ink-muted">
                  <span className="font-semibold text-ink">{s.label}:</span> {s.latest ? `${Math.round(s.latest[1]).toLocaleString('en-US')} thousand` : 'n/a'}{' '}
                  {s.yoyPct !== null && <span>({s.yoyPct > 0 ? 'up' : 'down'} {Math.abs(s.yoyPct).toFixed(1)}% in a year)</span>}
                </p>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-muted">
              What the research found: the U.S. International Trade Commission's 2023 study of the 2018 steel and aluminum tariffs found that steel output rose and
              industries that buy steel paid more.{' '}
              <a href="https://www.usitc.gov/publications/332/pub5405.pdf" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Read the study (USITC Publication 5405)
              </a>
              .
            </p>
            <ChartFooter source="U.S. Bureau of Labor Statistics, Current Employment Statistics" sourceUrl="https://www.bls.gov/ces/" asOf={data.jobs[0]?.latest?.[0].slice(0, 7)} />
          </PulsePanel>

          <PulsePanel
            title="How much tariffs collect"
            subtitle="Customs duties paid to the U.S. Treasury each month, in billions of dollars."
            help="Gross receipts are what importers paid; 'after refunds' subtracts duties paid back, for example when a tariff is later found not to be owed. Customs duties are mostly tariffs."
          >
            {customsLines.length > 0 ? (
              <TrendChart lines={customsLines} format={(v) => `$${v.toFixed(0)}B`} min={0} ariaLabel="Monthly customs duties collected, gross and after refunds, in billions of dollars." />
            ) : (
              <p className="text-sm text-ink-faint">The customs series is still loading into this site; it refreshes daily.</p>
            )}
            {gross?.latest && (
              <p className="mt-3 text-sm text-ink-muted">
                In {monthName(gross.latest[0])} importers paid <span className="font-semibold text-ink">{usdB(gross.latest[1])}</span> in customs duties
                {net?.latest && net.latest[0] === gross.latest[0] ? `; after refunds the Treasury kept ${usdB(net.latest[1])}` : ''}.
                {gross.yoyPct !== null ? ` That is ${gross.yoyPct > 0 ? 'up' : 'down'} ${Math.abs(gross.yoyPct).toFixed(0)}% from a year earlier.` : ''}
              </p>
            )}
            <ChartFooter
              source="U.S. Treasury, Monthly Treasury Statement (Table 4)"
              sourceUrl="https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/receipts-of-the-u-s-government"
              asOf={gross?.latest?.[0].slice(0, 7)}
              csv={{
                filename: 'aex-terminal-customs-duties.csv',
                header: ['month', 'gross_usd', 'net_usd', 'source'],
                rows: (gross?.points ?? []).map(([d, v]) => [d.slice(0, 7), v, net?.points.find((p) => p[0] === d)?.[1] ?? '', 'U.S. Treasury MTS Table 4']),
              }}
            />
          </PulsePanel>

          <EffectiveTariffRate partnerCodes />

          <FreightPanel />

          <PulsePanel title="Check one product">
            <p className="text-sm text-ink-muted">
              Want the tariff on a specific product from a specific country? Use the{' '}
              <Link to="/lookup" className="font-semibold text-accent hover:underline">
                free tariff lookup
              </Link>
              . Buying small packages from abroad? Read{' '}
              <Link to="/de-minimis" className="font-semibold text-accent hover:underline">
                what changed for small packages
              </Link>
              .
            </p>
          </PulsePanel>
        </div>
      )}
    </div>
  );
}
