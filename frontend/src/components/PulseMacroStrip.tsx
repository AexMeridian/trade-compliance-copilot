import type { MarketTile } from '../types/pulse';
import { MARKET_HINTS } from '../lib/pulseGlossary';
import { PulseDelta } from './PulseDelta';
import { PulseSpark } from './PulseCharts';

// Same ruled-board idiom as PulseMarketStrip, but for monthly government
// data instead of daily quotes: month-over-month and year-over-year are the
// standard way these are reported (a "3-month window" reads oddly for
// something that only updates once a month), and payrolls/unemployment need
// their own formatting (jobs, percentage points) rather than index points.
function formatValue(t: MarketTile, v: number = t.value): string {
  if (t.id === 'BLS:UNRATE') return `${v.toFixed(1)}%`;
  if (t.id === 'BLS:PAYROLLS') return `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M jobs`;
  return v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatChange(t: MarketTile, change: number | null, pct: number | null): string {
  if (change === null) return '';
  if (t.id === 'BLS:PAYROLLS') return `${change >= 0 ? '+' : ''}${Math.round(change).toLocaleString('en-US')}k jobs`;
  if (t.changeMode === 'absolute') return `${Math.abs(change).toFixed(1)} pts`;
  return pct !== null ? `${Math.abs(pct).toFixed(1)}%` : `${Math.abs(change).toFixed(1)}`;
}

export function PulseMacroStrip({ tiles }: { tiles: MarketTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="card divide-y divide-hairline">
      {tiles.map((t) => (
        <li
          key={t.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-l-4 border-transparent px-4 py-3 hover:border-accent sm:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem_minmax(0,1fr)]"
        >
          <div className="min-w-0">
            <h3 className="truncate font-sans text-[15px] font-semibold leading-snug tracking-normal" title={MARKET_HINTS[t.id]}>
              {t.label}
            </h3>
            <p className="text-xs text-ink-faint">as of {t.asOf.slice(0, 7)}</p>
          </div>
          <div className="text-right sm:text-left">
            <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="display block text-[26px] text-ink no-underline hover:text-accent">
              {formatValue(t)}
            </a>
          </div>
          <div className="hidden sm:block">
            {t.change !== null && (
              <p className="text-[13px] text-ink-faint">
                vs last month <PulseDelta change={t.change} text={formatChange(t, t.change, t.changePct)} className="font-semibold" />
              </p>
            )}
          </div>
          <div className="hidden sm:block">
            {t.yoyChangePct !== null && (
              <p className="text-[13px] text-ink-faint">
                vs a year ago <PulseDelta change={t.yoyChangePct} text={`${Math.abs(t.yoyChangePct).toFixed(1)}%`} className="font-semibold" />
              </p>
            )}
          </div>
          <div className="hidden sm:block">
            <PulseSpark values={t.points.map((p) => p[1])} dates={t.points.map((p) => p[0])} monthly format={(v) => formatValue(t, v)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
