import { Link, useLocation } from 'react-router-dom';
import { useSharedMarkets } from '../lib/marketStore';
import { PulseDelta } from './PulseDelta';

// A slim strip of live reference numbers under the header, on every page, in the manner of a newsroom's
// market bar: today's date, then currency rates against the U.S. dollar (ECB) and two headline U.S.
// statistics (BLS). Stock and commodity tiles join automatically when those quotes are switched on. Each
// figure shows its own as-of date through its tooltip; nothing here is a live tick.
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const short = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const formatRate = (r: number) => r.toLocaleString('en-US', { minimumFractionDigits: r < 10 ? 4 : 2, maximumFractionDigits: r < 10 ? 4 : 2 });

const FIVE_MIN = 5 * 60_000;

export function MarketStrip() {
  const onPulse = useLocation().pathname === '/';
  // Pulse refreshes the numbers itself; every other page refreshes them from here.
  const markets = useSharedMarkets(1500, onPulse ? 0 : FIVE_MIN);
  const fx = (markets?.currencies ?? []).slice(0, 6);
  const tiles = markets?.tiles ?? [];
  const cpi = tiles.find((t) => t.id === 'BLS:CPI');
  const unrate = tiles.find((t) => t.id === 'BLS:UNRATE');
  const quotes = tiles.filter((t) => t.group === 'U.S. stocks').slice(0, 3);

  const item = 'flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-ink no-underline';
  // One pass through every figure. It is rendered more than once so the band can scroll without a gap; the
  // extra passes are hidden from assistive technology and from the tab order.
  const pass = (hidden: boolean) => {
    const tab = hidden ? -1 : undefined;
    return (
      <>
        {quotes.map((t) => (
          <Link key={t.id} to="/?tab=markets" tabIndex={tab} className={item} title={`${t.label}, as of ${t.asOf}`}>
            <span className="text-ink-muted">{t.label}</span>
            <span className="tabular-nums">{t.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            {t.changePct !== null && <PulseDelta change={t.changePct} text={`${Math.abs(t.changePct).toFixed(2)}%`} />}
          </Link>
        ))}
        {fx.map((r) => (
          <Link key={r.quote} to="/?tab=markets" tabIndex={tab} className={item} title={`${r.label}, ECB reference rate for ${r.asOf}; change over 30 days`}>
            <span className="text-ink-muted">{r.label}</span>
            <span className="tabular-nums">{formatRate(r.rate)}</span>
            <PulseDelta change={r.change30dPct} text={`${Math.abs(r.change30dPct ?? 0).toFixed(2)}%`} />
          </Link>
        ))}
        {cpi && (
          <Link to="/?tab=markets" tabIndex={tab} className={item} title={`Consumer prices, as of ${cpi.asOf.slice(0, 7)}; change from the month before`}>
            <span className="text-ink-muted">CPI</span>
            <span className="tabular-nums">{cpi.value.toFixed(1)}</span>
            {cpi.changePct !== null && <PulseDelta change={cpi.changePct} text={`${Math.abs(cpi.changePct).toFixed(1)}%`} />}
          </Link>
        )}
        {unrate && (
          <Link to="/?tab=markets" tabIndex={tab} className={item} title={`Unemployment rate, as of ${unrate.asOf.slice(0, 7)}`}>
            <span className="text-ink-muted">Unemployment</span>
            <span className="tabular-nums">{unrate.value.toFixed(1)}%</span>
          </Link>
        )}
      </>
    );
  };

  return (
    <div className="no-print border-b border-hairline bg-paper">
      <div className="mx-auto flex max-w-7xl items-center gap-x-5 px-4 py-2 text-[13px]">
        <span className="shrink-0 font-semibold text-ink">{dayFmt.format(new Date())}</span>
        {/* The band scrolls on its own and pauses while pointed at or focused. With reduced motion it stays still and can be scrolled by hand. */}
        <div className="ticker min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" aria-label="Currency rates and key statistics" role="group">
          <div className="ticker-track flex w-max items-center">
            <div className="flex items-center gap-x-5 pr-5">{pass(false)}</div>
            <div className="ticker-extra items-center gap-x-5 pr-5" aria-hidden="true">
              {pass(true)}
            </div>
            <div className="ticker-extra items-center gap-x-5 pr-5" aria-hidden="true">
              {pass(true)}
            </div>
            <div className="ticker-extra items-center gap-x-5 pr-5" aria-hidden="true">
              {pass(true)}
            </div>
          </div>
        </div>
        {fx[0] && <span className="hidden shrink-0 text-ink-faint sm:inline">ECB rates, {short(fx[0].asOf)}</span>}
      </div>
    </div>
  );
}
