import { useEffect, useState } from 'react';
import { getAdvisories, getFxHistory, type TravelAdvisory } from '../lib/api';
import { PulsePanel } from './PulsePanel';
import { Sparkline } from './Sparkline';
import { currencyName } from '../lib/fxWords';

// For travelers and families (user testing: the nurse who sends money home and plans trips wanted the exchange rate in plain words,
// its trend, a converter and whether travel is advised against). Official sources only: ECB reference rates and the State Department.

const LEVEL_TEXT: Record<number, string> = {
  1: 'Level 1: exercise normal precautions',
  2: 'Level 2: exercise increased caution',
  3: 'Level 3: reconsider travel',
  4: 'Level 4: do not travel',
};
const LEVEL_TONE: Record<number, string> = { 1: 'text-clear', 2: 'text-review', 3: 'text-stop', 4: 'text-stop' };
const fmt = (n: number, digits = 2) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function TravelersBox({ code, name, currency }: { code: string; name: string; currency?: string }) {
  const [advisory, setAdvisory] = useState<TravelAdvisory | null | 'none'>(null);
  const [fx, setFx] = useState<[string, number][] | null>(null);
  const [amount, setAmount] = useState('500');

  useEffect(() => {
    let live = true;
    getAdvisories()
      .then((r) => live && setAdvisory(r.items.find((i) => i.country === code) ?? 'none'))
      .catch(() => live && setAdvisory('none'));
    if (currency && currency !== 'USD') {
      getFxHistory(currency)
        .then((r) => live && setFx(r.points))
        .catch(() => live && setFx([]));
    }
    return () => {
      live = false;
    };
  }, [code, currency]);

  if (code === 'US') return null;
  const latest = fx?.at(-1) ?? null;
  const yearAgo = fx && fx.length > 200 ? fx[0] : null;
  const change = latest && yearAgo ? ((latest[1] - yearAgo[1]) / yearAgo[1]) * 100 : null;
  const cur = currency ? currencyName(currency) : null;
  const dollars = Number(amount.replace(/[^0-9.]/g, ''));

  return (
    <PulsePanel
      title="For travelers and families"
      subtitle={`Exchange rate and travel advice for ${name}.`}
      help="Exchange rates are the European Central Bank's daily reference rates, a mid-market rate: banks and money-transfer services add a margin and fees, so you will receive somewhat less. The travel advisory is the U.S. State Department's own level for the whole country; read it for regional details."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          {currency && currency !== 'USD' && latest ? (
            <>
              <p className="text-base text-ink">
                One U.S. dollar buys <span className="font-semibold tabular-nums">{fmt(latest[1])}</span> {cur ?? currency}s ({latest[0]}).
              </p>
              {change !== null && (
                <p className="mt-1 text-sm text-ink-muted">
                  {Math.abs(change) < 0.5
                    ? `About the same as a year ago.`
                    : change > 0
                      ? `Your dollar buys ${fmt(Math.abs(change), 1)}% more than a year ago (the ${cur} is weaker).`
                      : `Your dollar buys ${fmt(Math.abs(change), 1)}% less than a year ago (the ${cur} is stronger).`}
                </p>
              )}
              {fx && fx.length > 2 && (
                <div className="mt-2" aria-hidden="true">
                  <Sparkline points={fx.map(([d, v]) => [Date.parse(d) / 86_400_000, v] as [number, number])} color="var(--color-hue-blue-ink)" width={240} height={36} />
                  <p className="text-[11px] text-ink-faint">Last 12 months, {currency} per dollar</p>
                </div>
              )}
              <label className="mt-3 block text-sm text-ink-muted">
                Convert U.S. dollars
                <span className="mt-1 flex items-center gap-2">
                  <span className="text-ink">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-28 border border-hairline-strong bg-paper-raised px-2 py-1 text-base tabular-nums text-ink outline-none focus:border-accent"
                  />
                  <span className="tabular-nums text-ink">
                    = {Number.isFinite(dollars) ? fmt(dollars * latest[1]) : '?'} {currency}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-ink-faint">At the reference rate; transfer services charge fees and a margin on top.</span>
              </label>
            </>
          ) : currency && currency !== 'USD' && fx === null ? (
            <p className="text-sm text-ink-faint">Loading the exchange rate…</p>
          ) : (
            <p className="text-sm text-ink-muted">
              {currency === 'USD' ? `${name} uses the U.S. dollar.` : `This site has no daily reference rate for ${name}'s currency.`}
            </p>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Sending money? Compare the real cost of transfer services on the{' '}
            <a href="https://remittanceprices.worldbank.org" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              World Bank's Remittance Prices Worldwide
            </a>
            .
          </p>
        </div>
        <div>
          {advisory === null ? (
            <p className="text-sm text-ink-faint">Loading the travel advisory…</p>
          ) : advisory === 'none' ? (
            <p className="text-sm text-ink-muted">
              No country-wide advisory found for {name}.{' '}
              <a href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Check travel.state.gov
              </a>
              .
            </p>
          ) : (
            <>
              <p className={`text-base font-semibold ${LEVEL_TONE[advisory.level] ?? 'text-ink'}`}>{LEVEL_TEXT[advisory.level] ?? advisory.title}</p>
              <p className="mt-1 text-sm text-ink-muted">
                U.S. State Department travel advisory{advisory.updated ? `, updated ${advisory.updated}` : ''}. Parts of a country can carry a higher level.{' '}
                <a href={advisory.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Read the full advisory
                </a>
                .
              </p>
            </>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Bringing things back? See what you can bring into the U.S. duty-free in{' '}
            <a href="https://www.cbp.gov/travel/us-citizens/know-before-you-go" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              CBP's Know Before You Go
            </a>
            .
          </p>
        </div>
      </div>
    </PulsePanel>
  );
}
