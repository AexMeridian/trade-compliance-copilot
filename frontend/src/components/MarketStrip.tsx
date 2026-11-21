import { Link, useLocation } from 'react-router-dom';
import { useSharedMarkets } from '../lib/marketStore';
import { PulseDelta } from './PulseDelta';
import { setMotionPaused, useMotionPaused } from '../lib/motion';

// A slim strip of live reference numbers under the header, on every page, in the manner of a newsroom's
// market bar: today's date, then currency rates against the U.S. dollar (ECB) and two headline U.S.
// statistics (BLS). Stock and commodity tiles join automatically when those quotes are switched on. Each
// figure shows its own as-of date through its tooltip; nothing here is a live tick.
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const short = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// A short date for a phone, where the full weekday and month would take 40% of the bar.
const shortDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatRate = (r: number) => r.toLocaleString('en-US', { minimumFractionDigits: r < 10 ? 4 : 2, maximumFractionDigits: r < 10 ? 4 : 2 });

const FIFTEEN_MIN = 15 * 60_000; // the server holds this data for 5 minutes anyway; polling faster only costs database reads

export function MarketStrip() {
  const paused = useMotionPaused();
  const onPulse = useLocation().pathname === '/';
  // Pulse refreshes the numbers itself; every other page refreshes them from here.
  const markets = useSharedMarkets(1500, onPulse ? 0 : FIFTEEN_MIN);
  const fx = (markets?.currencies ?? []).slice(0, 6);
  const tiles = markets?.tiles ?? [];
  const cpi = tiles.find((t) => t.id === 'BLS:CPI');
  const unrate = tiles.find((t) => t.id === 'BLS:UNRATE');
  const quotes = tiles.filter((t) => t.group === 'U.S. stocks').slice(0, 3);

  const item = 'mkt-item group flex shrink-0 items-baseline gap-2 whitespace-nowrap px-4 text-ink no-underline pointer-coarse:-my-3 pointer-coarse:py-3';
  // One pass through every figure. It is rendered more than once so the band can scroll without a gap; the
  // extra passes are hidden from assistive technology and from the tab order.
  const pass = (hidden: boolean) => {
    const tab = hidden ? -1 : undefined;
    return (
      <>
        {quotes.map((t) => (
          <Link key={t.id} to="/?tab=markets" tabIndex={tab} className={item} title={`${t.label}, as of ${t.asOf}`}>
            <span className="mkt-label">{t.label}</span>
            <span className="mkt-value">{t.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            {t.changePct !== null && <PulseDelta change={t.changePct} text={`${Math.abs(t.changePct).toFixed(2)}%`} />}
          </Link>
        ))}
        {fx.map((r) => (
          <Link key={r.quote} to="/?tab=markets" tabIndex={tab} className={item} title={`${r.label}, ECB reference rate for ${r.asOf}; change over 30 days`}>
            <span className="mkt-label">{r.label}</span>
            <span className="mkt-value">{formatRate(r.rate)}</span>
            <PulseDelta change={r.change30dPct} text={`${Math.abs(r.change30dPct ?? 0).toFixed(2)}%`} />
            <span className="mkt-period">30d</span>
          </Link>
        ))}
        {cpi && (
          <Link to="/?tab=markets" tabIndex={tab} className={item} title={`Consumer prices, as of ${cpi.asOf.slice(0, 7)}; change from the month before`}>
            <span className="mkt-label">CPI</span>
            <span className="mkt-value">{cpi.value.toFixed(1)}</span>
            {cpi.changePct !== null && <PulseDelta change={cpi.changePct} text={`${Math.abs(cpi.changePct).toFixed(1)}%`} />}
            {cpi.changePct !== null && <span className="mkt-period">m/m</span>}
          </Link>
        )}
        {unrate && (
          <Link to="/?tab=markets" tabIndex={tab} className={item} title={`Unemployment rate, as of ${unrate.asOf.slice(0, 7)}`}>
            <span className="mkt-label">Unemployment</span>
            <span className="mkt-value">{unrate.value.toFixed(1)}%</span>
          </Link>
        )}
      </>
    );
  };

  return (
    <div role="region" aria-label="Currency rates" title={fx[0] ? `Currency rates: ECB reference rates, ${short(fx[0].asOf)}` : undefined} className="market-bar no-print">
      <div className="mx-auto flex max-w-7xl items-center px-4 text-[13px]">
        <span className="mkt-date shrink-0" title={dayFmt.format(new Date())}>
          <span className="sm:hidden">{shortDay.format(new Date())}</span>
          <span className="hidden sm:inline">{dayFmt.format(new Date())}</span>
        </span>
        {/* The band scrolls on its own and pauses while pointed at or focused. With reduced motion it stays still and can be scrolled by hand. */}
        <div className="ticker min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" aria-label="Currency rates and key statistics" role="group">
          <div className="ticker-track flex w-max items-center pr-6">
            <div className="flex items-center ">{pass(false)}</div>
            <div className="ticker-extra items-center " aria-hidden="true">
              {pass(true)}
            </div>
            <div className="ticker-extra items-center " aria-hidden="true">
              {pass(true)}
            </div>
            <div className="ticker-extra items-center " aria-hidden="true">
              {pass(true)}
            </div>
          </div>
        </div>
        {/* Moving content needs a visible stop (WCAG 2.2.2). One switch pauses the ticker, the globes and the starfield; hidden when the system already asks for less motion. */}
        <button
          type="button"
          onClick={() => setMotionPaused(!paused)}
          aria-pressed={paused}
          title={paused ? 'Resume the moving ticker and globe' : 'Pause the moving ticker and globe'}
          className="motion-toggle ml-2 flex shrink-0 items-center gap-1.5 rounded px-2 text-[12px] font-semibold text-ink-muted hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M7 4l13 8-13 8z" /> : <path d="M6 4h4v16H6zM14 4h4v16h-4z" />}
          </svg>
          <span className="hidden sm:inline">{paused ? 'Play motion' : 'Pause motion'}</span>
          <span className="sr-only sm:hidden">{paused ? 'Play motion' : 'Pause motion'}</span>
        </button>
      </div>
    </div>
  );
}
