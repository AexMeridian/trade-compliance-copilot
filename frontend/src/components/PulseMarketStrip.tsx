import type { MarketTile } from '../types/pulse';
import { GROUP_HUE } from '../lib/pulseColors';
import { MARKET_HINTS } from '../lib/pulseGlossary';
import { PulseDelta } from './PulseDelta';
import { PulsePanel } from './PulsePanel';
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

const GRID_BY_COUNT: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-5',
  8: 'grid-cols-2 lg:grid-cols-4',
};

// Quotes come from Yahoo Finance's public chart data (roughly 15 minutes
// delayed) -- each tile says which day it's for, so nothing reads as more
// current than it is.
export function PulseMarketStrip({ tiles }: { tiles: MarketTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className={`grid gap-px bg-hairline ${GRID_BY_COUNT[tiles.length] ?? 'grid-cols-2 sm:grid-cols-3'}`}>
      {tiles.map((t, i) => {
        const win = windowChange(t);
        return (
          <PulsePanel
            key={t.id}
            title={t.label}
            subtitle={`as of ${t.asOf}`}
            accent={GROUP_HUE[t.group]?.bg}
            className={tiles.length === 5 && i === 4 ? 'col-span-2 lg:col-span-1' : ''}
          >
            <div title={MARKET_HINTS[t.id]} className="font-mono text-xl font-semibold text-ink">
              <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="text-ink no-underline hover:text-accent">
                {formatValue(t)}
              </a>
              <PulseDelta change={t.change} text={formatMagnitude(t.change ?? 0, t.changePct)} className="block text-sm font-normal" />
            </div>
            <PulseSpark values={t.points.map((p) => p[1])} className="mt-3" />
            {win && (
              <p className="mt-1 flex items-center gap-1.5 font-sans text-[11px] text-ink-faint">
                3 mo
                <PulseDelta change={win.change} text={win.text} className="text-[11px]" />
              </p>
            )}
          </PulsePanel>
        );
      })}
    </div>
  );
}
