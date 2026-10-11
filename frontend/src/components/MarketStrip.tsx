import { Link } from 'react-router-dom';
import { useSharedMarkets } from '../lib/marketStore';
import { PulseDelta } from './PulseDelta';

// A slim strip of live reference numbers under the header, on every page, in the manner of a newsroom's
// market bar: today's date, then currency rates against the U.S. dollar (ECB) and two headline U.S.
// statistics (BLS). Stock and commodity tiles join automatically when those quotes are switched on. Each
// figure shows its own as-of date through its tooltip; nothing here is a live tick.
const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const short = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const formatRate = (r: number) => r.toLocaleString('en-US', { minimumFractionDigits: r < 10 ? 4 : 2, maximumFractionDigits: r < 10 ? 4 : 2 });

export function MarketStrip() {
  const markets = useSharedMarkets();
  const fx = (markets?.currencies ?? []).slice(0, 6);
  const tiles = markets?.tiles ?? [];
  const cpi = tiles.find((t) => t.id === 'BLS:CPI');
  const unrate = tiles.find((t) => t.id === 'BLS:UNRATE');
  const quotes = tiles.filter((t) => t.group === 'U.S. stocks').slice(0, 3);

  return (
    <div className="no-print border-b border-hairline bg-paper">
      <div className="mx-auto flex max-w-7xl items-center gap-x-5 overflow-x-auto px-4 py-2 text-[13px] [scrollbar-width:none]">
        <span className="shrink-0 font-semibold text-ink">{dayFmt.format(new Date())}</span>
        {quotes.map((t) => (
          <Link key={t.id} to="/?tab=markets" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-ink no-underline" title={`${t.label}, as of ${t.asOf}`}>
            <span className="text-ink-muted">{t.label}</span>
            <span className="tabular-nums">{t.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            {t.changePct !== null && <PulseDelta change={t.changePct} text={`${Math.abs(t.changePct).toFixed(2)}%`} />}
          </Link>
        ))}
        {fx.map((r) => (
          <Link key={r.quote} to="/?tab=markets" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-ink no-underline" title={`${r.label}, ECB reference rate for ${r.asOf}; change over 30 days`}>
            <span className="text-ink-muted">{r.label}</span>
            <span className="tabular-nums">{formatRate(r.rate)}</span>
            <PulseDelta change={r.change30dPct} text={`${Math.abs(r.change30dPct ?? 0).toFixed(2)}%`} />
          </Link>
        ))}
        {cpi && (
          <Link to="/?tab=markets" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-ink no-underline" title={`Consumer prices, as of ${cpi.asOf.slice(0, 7)}; change from the month before`}>
            <span className="text-ink-muted">CPI</span>
            <span className="tabular-nums">{cpi.value.toFixed(1)}</span>
            {cpi.changePct !== null && <PulseDelta change={cpi.changePct} text={`${Math.abs(cpi.changePct).toFixed(1)}%`} />}
          </Link>
        )}
        {unrate && (
          <Link to="/?tab=markets" className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-ink no-underline" title={`Unemployment rate, as of ${unrate.asOf.slice(0, 7)}`}>
            <span className="text-ink-muted">Unemployment</span>
            <span className="tabular-nums">{unrate.value.toFixed(1)}%</span>
          </Link>
        )}
        {fx[0] && <span className="ml-auto shrink-0 pl-4 text-ink-faint">ECB rates, {short(fx[0].asOf)}</span>}
      </div>
    </div>
  );
}
