import type { MarketTile } from '../types/pulse';
import { MARKET_HINTS } from '../lib/pulseGlossary';
import { PulseDelta } from './PulseDelta';
import { PulseSpark } from './PulseCharts';

const nf = (digits: number) => ({ minimumFractionDigits: digits, maximumFractionDigits: digits });
// Priced in dollars (shares and futures), as opposed to index points.
const DOLLAR_PRICED = new Set(['FDX', 'UPS', 'ZIM', 'CAT', 'BA', 'AAPL', 'WMT', 'TSM', 'CL=F', 'BZ=F', 'NG=F', 'GC=F', 'HG=F']);

function formatValue(t: MarketTile): string {
  if (t.id === '^TNX') return `${t.value.toLocaleString('en-US', nf(2))}%`;
  if (DOLLAR_PRICED.has(t.id)) return `$${t.value.toLocaleString('en-US', nf(2))}`;
  return t.value.toLocaleString('en-US', nf(2));
}

function formatMagnitude(change: number, pct: number | null): string {
  return pct !== null ? `${Math.abs(pct).toFixed(2)}%` : `${Math.abs(change).toFixed(2)} pts`;
}

// Whole-window change (first to last point on the chart), in the tile's own
// unit: percent for levels, absolute for rates and gauges.
function windowChange(t: MarketTile): { change: number; text: string } | null {
  if (t.points.length < 2) return null;
  const first = t.points[0][1];
  const change = t.points[t.points.length - 1][1] - first;
  const pct = t.changeMode === 'percent' && first !== 0 ? (change / first) * 100 : null;
  return { change, text: formatMagnitude(change, pct) };
}

// Quotes come from Yahoo Finance's public chart data (roughly 15 minutes
// delayed). Each row says which day it is for, so nothing reads as more
// current than it is. The plain-language explanation of each series is the
// tooltip on its name. Laid out as a ruled board (one row per market) rather
// than a wall of boxes, so a column of numbers can be scanned top to bottom.
export function PulseMarketStrip({ tiles }: { tiles: MarketTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="card divide-y divide-hairline">
      {tiles.map((t) => {
        const win = windowChange(t);
        return (
          <li
            key={t.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-l-4 border-transparent px-4 py-3 hover:border-accent sm:grid-cols-[minmax(0,1fr)_9rem_6.5rem_minmax(0,1.3fr)_8rem]"
          >
            <div className="min-w-0">
              <h3
                className="truncate font-sans text-[15px] font-semibold leading-snug tracking-normal"

                title={MARKET_HINTS[t.id]}
              >
                {t.label}
              </h3>
              <p className="text-xs text-ink-faint">as of {t.asOf}</p>
            </div>
            <div className="text-right sm:text-left">
              <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="display block text-[28px] text-ink no-underline hover:text-accent">
                {formatValue(t)}
              </a>
              <PulseDelta change={t.change} text={formatMagnitude(t.change ?? 0, t.changePct)} className="block text-[13px] sm:hidden" />
            </div>
            <PulseDelta change={t.change} text={formatMagnitude(t.change ?? 0, t.changePct)} className="hidden text-[15px] font-semibold sm:block" />
            <div className="hidden sm:block">
              <PulseSpark values={t.points.map((p) => p[1])} />
            </div>
            <p className="hidden text-[13px] text-ink-faint sm:block">
              {win ? (
                <>
                  3 months <PulseDelta change={win.change} text={win.text} className="font-semibold" />
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
