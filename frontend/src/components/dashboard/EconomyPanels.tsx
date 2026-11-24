import type { EconomyData } from '../../lib/api';
import { Bars, Direction, Panel, Spark, monthYear, pct, shortDate } from './Panel';

// "Markets and economy": what it costs to borrow, how prices and jobs are doing, commodities, the dollar and the dollar's role in the world.

export const ECONOMY_PANELS = [
  { id: 'rates', label: 'Borrowing rates' },
  { id: 'inflation', label: 'Prices' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'commodities', label: 'Oil, metals and food' },
  { id: 'currencies', label: 'The dollar against other currencies' },
  { id: 'dollar', label: "The dollar's role in the world" },
  { id: 'tradeprices', label: 'Import and export prices' },
];

const TREASURY = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates';
const BLS = 'https://www.bls.gov/';

function Change({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  return value == null ? <span className="text-ink-faint">—</span> : <Direction value={value}>{pct(value)}{suffix}</Direction>;
}

export function EconomySection({ data, show }: { data: EconomyData; show: (id: string) => boolean }) {
  const { rates, inflation, jobs, commodities, currencies, dollarRole, tradePrices } = data;
  const maxRate = rates ? Math.max(...rates.curve.map((c) => c.pct), 1) : 1;
  const movers = currencies.slice(0, 8);
  const maxMove = Math.max(...movers.map((c) => Math.abs(c.change30dPct ?? 0)), 0.1);
  const topHolders = dollarRole?.topHolders ?? [];
  const maxHolder = Math.max(...topHolders.map((h) => h.billions), 1);

  return (
    <div className="gap-4 md:columns-2 xl:columns-3">
      {rates && show('rates') && (
        <Panel id="rates" title="What the government pays to borrow" what="Interest rates on U.S. government loans of different lengths. They set the tone for mortgages, car loans and business loans." source="U.S. Treasury" sourceUrl={TREASURY} asOf={rates.asOf} table={{ head: ['Length', 'Rate'], rows: rates.curve.map((c) => [c.label, `${c.pct.toFixed(2)}%`]) }} limit={rates.inverted ? 'Short-term borrowing currently costs more than long-term borrowing, which is unusual.' : undefined}>
          <Bars rows={rates.curve.map((c) => ({ label: c.label, text: `${c.pct.toFixed(2)}%`, size: c.pct / maxRate }))} />
        </Panel>
      )}

      {inflation && show('inflation') && (
        <Panel id="inflation" title="Prices" what="How much more or less everyday things cost than about a year ago." source="U.S. Bureau of Labor Statistics" sourceUrl={BLS + 'cpi/'} asOf={inflation.cpi?.latest ?? inflation.prices[0]?.latest ?? null} more={{ to: '/prices', label: 'Tariffs and your wallet' }} table={{ head: ['Item', 'Change', 'Compared with'], rows: [...(inflation.cpi ? [inflation.cpi] : []), ...inflation.prices].map((p) => [p.label, p.changePct == null ? '—' : pct(p.changePct), p.since ? monthYear(p.since) : '—']) }} limit="The government did not collect October 2025 prices, so some comparisons use the nearest month and say which.">
          {inflation.cpi && (
            <p className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-ink-muted">All consumer prices</span>
              <span className="display text-2xl tabular-nums text-ink">
                <Change value={inflation.cpi.changePct} />
              </span>
            </p>
          )}
          <ul className="flex flex-col divide-y divide-hairline">
            {inflation.prices.slice(0, 9).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">{p.label}</span>
                <Spark points={p.points} width={56} height={20} />
                <span className="w-16 text-right font-semibold text-ink">
                  <Change value={p.changePct} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {jobs && show('jobs') && (
        <Panel id="jobs" title="Jobs" what="Whether people who want work can find it, and whether employers are adding jobs." source="U.S. Bureau of Labor Statistics" sourceUrl={BLS + 'cps/'} asOf={jobs.unemployment?.asOf ?? jobs.payrolls?.asOf ?? null} more={{ to: '/prices', label: 'Jobs in tariff industries' }} table={{ head: ['Industry', 'Jobs vs a year ago'], rows: jobs.industries.map((j) => [j.label, j.changePct == null ? '—' : pct(j.changePct)]) }}>
          {jobs.unemployment && (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="display text-3xl tabular-nums text-ink">{jobs.unemployment.pct.toFixed(1)}%</p>
                <p className="text-[13px] text-ink-muted">of workers are looking for a job{jobs.unemployment.changePts == null ? '' : jobs.unemployment.changePts === 0 ? ', unchanged from last month' : `, ${jobs.unemployment.changePts > 0 ? 'up' : 'down'} ${Math.abs(jobs.unemployment.changePts).toFixed(1)} points from last month`}</p>
              </div>
              <Spark points={jobs.unemployment.points} width={84} height={30} fill />
            </div>
          )}
          {jobs.payrolls?.monthlyChangeThousands != null && (
            <p className="mt-2 text-[13px] text-ink-muted">
              Employers {jobs.payrolls.monthlyChangeThousands >= 0 ? 'added' : 'cut'} about <span className="font-semibold text-ink">{Math.abs(Math.round(jobs.payrolls.monthlyChangeThousands * 1000)).toLocaleString('en-US')}</span> jobs in the latest month.
            </p>
          )}
          {jobs.industries.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-hairline border-t border-hairline">
              {jobs.industries.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{j.label}</span>
                  <Spark points={j.points} width={48} height={18} />
                  <span className="w-16 text-right font-semibold text-ink">
                    <Change value={j.changePct} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {commodities.length > 0 && show('commodities') && (
        <Panel id="commodities" title="Oil, metals and food" what="World prices of things countries buy and sell in bulk. Change is from the month before." source="International Monetary Fund" sourceUrl="https://www.imf.org/en/Research/commodity-prices" asOf={commodities[0].asOf} table={{ head: ['Commodity', 'Price', 'Unit', 'Change'], rows: commodities.map((c) => [c.label, c.value.toLocaleString('en-US', { maximumFractionDigits: 2 }), c.unit, c.changePct == null ? '—' : pct(c.changePct)]) }}>
          <ul className="flex flex-col divide-y divide-hairline">
            {commodities.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-1.5 text-[13px]">
                <span className="min-w-0">
                  <span className="block truncate text-ink">{c.label}</span>
                  <span className="block truncate text-[11px] text-ink-faint">{c.unit.toLowerCase()}</span>
                </span>
                <Spark points={c.points} width={48} height={18} />
                <span className="w-24 text-right">
                  <span className="block font-semibold tabular-nums text-ink">{c.value.toLocaleString('en-US', { maximumFractionDigits: c.value < 100 ? 2 : 0 })}</span>
                  <span className="block text-[11px] text-ink-muted">
                    <Change value={c.changePct} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {currencies.length > 0 && show('currencies') && (
        <Panel id="currencies" title="The dollar against other currencies" what="Which currencies moved the most against the dollar in the past 30 days. 'Down' means the dollar buys less of it." source="European Central Bank" sourceUrl="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" asOf={null} table={{ head: ['Currency', 'Per $1', '30-day change'], rows: currencies.map((c) => [c.name, c.rate.toLocaleString('en-US', { maximumFractionDigits: 3 }), c.change30dPct == null ? '—' : pct(c.change30dPct)]) }}>
          <Bars rows={movers.map((c) => ({ label: c.name, size: Math.abs(c.change30dPct ?? 0) / maxMove, text: c.change30dPct == null ? '—' : <Change value={c.change30dPct} /> }))} />
        </Panel>
      )}

      {dollarRole && show('dollar') && (
        <Panel id="dollar" title="The dollar's role in the world" what="How much of the world's savings is kept in dollars, and who lends money to the U.S. government." source="IMF and U.S. Treasury" sourceUrl="https://data.imf.org/en/datasets/IMF.STA:COFER" asOf={dollarRole.holdersAsOf ?? dollarRole.reservesAsOf} more={{ to: '/hard-power', label: 'Money and the dollar' }} table={{ head: ['Holder', 'Billions of dollars', 'A year ago'], rows: topHolders.map((h) => [h.label, h.billions.toFixed(0), h.yearAgoBillions == null ? '—' : h.yearAgoBillions.toFixed(0)]) }} limit="Holders are listed by where the securities are kept, so some countries appear larger or smaller than their own holdings.">
          {dollarRole.reservesPct != null && (
            <p className="mb-2">
              <span className="display text-3xl tabular-nums text-ink">{dollarRole.reservesPct.toFixed(1)}%</span>
              <span className="ml-2 text-[13px] text-ink-muted">of the world's central-bank reserves are in dollars{dollarRole.reservesAsOf ? ` (${shortDate(dollarRole.reservesAsOf)})` : ''}</span>
            </p>
          )}
          {topHolders.length > 0 && (
            <>
              <p className="mb-1 text-xs font-semibold text-ink-muted">Biggest holders of U.S. government debt, in billions of dollars</p>
              <Bars rows={topHolders.map((h) => ({ label: h.label, size: h.billions / maxHolder, text: h.billions.toFixed(0) }))} />
            </>
          )}
        </Panel>
      )}

      {tradePrices.length > 0 && show('tradeprices') && (
        <Panel id="tradeprices" title="Import and export prices" what="Whether goods coming into and going out of the country cost more or less than before. Change is from the month before." source="U.S. Bureau of Labor Statistics" sourceUrl={BLS + 'mxp/'} asOf={tradePrices[0].asOf} table={{ head: ['Measure', 'Change'], rows: tradePrices.map((t) => [t.label, t.changePct == null ? '—' : pct(t.changePct)]) }}>
          <ul className="flex flex-col divide-y divide-hairline">
            {tradePrices.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-ink">{t.label}</span>
                <Spark points={t.points} width={56} height={20} />
                <span className="w-16 text-right font-semibold text-ink">
                  <Change value={t.changePct} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
