import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getUnAlignment, type UnAlignment } from '../lib/api';
import { nameFor } from '../lib/powerCountries';
import { alignmentBand, BAND_LABELS, positionBetween, type AlignmentBand } from '../lib/powerStats';
import { WORLD_COUNTRIES } from '../lib/worldCountries';
import { ChartFooter } from './ChartFooter';

// Loaded on its own so the map library does not slow the rest of the page.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

// One color per band, from China's end (orange) through the middle (neutral) to the United States' end (blue).
const BAND_COLORS: Record<AlignmentBand, string> = {
  china: '#f97316',
  leanChina: '#fdba74',
  middle: '#a8a29e',
  leanUs: '#93c5fd',
  us: '#3b82f6',
};
const BANDS = Object.keys(BAND_COLORS) as AlignmentBand[];

// A map of how every country votes in the UN General Assembly, placed between the United States' position and China's in the
// same year. It shows a pattern of behavior, not influence: countries may vote alike for many reasons. Russia is not a band on
// the map (it sits in the middle of the axis, which would paint Europe "nearest Russia" whenever the United States moves to an
// extreme); its gap appears in each country's hover text and in the comparison rows below.
export function UnAlignmentGlobe() {
  const [data, setData] = useState<UnAlignment | null>(null);
  const [failed, setFailed] = useState(false);
  const [yearIdx, setYearIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUnAlignment()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const idx = data ? Math.min(yearIdx ?? data.years.length - 1, data.years.length - 1) : 0;
  const year = data?.years[idx];

  const view = useMemo(() => {
    if (!data || year === undefined) return null;
    const at = (cc: string) => data.positions[cc]?.[idx] ?? null;
    const us = at('US');
    const cn = at('CN');
    const ru = at('RU');
    if (us === null || cn === null) return null;
    const byCountry = new Map<string, { band: AlignmentBand; gapUs: number; gapCn: number; gapRu: number | null }>();
    const counts: Record<AlignmentBand, number> = { china: 0, leanChina: 0, middle: 0, leanUs: 0, us: 0 };
    for (const c of WORLD_COUNTRIES) {
      const p = at(c.code);
      if (p === null || c.code === 'US' || c.code === 'CN') continue;
      const band = alignmentBand(positionBetween(p, cn, us));
      byCountry.set(c.code, { band, gapUs: Math.abs(p - us), gapCn: Math.abs(p - cn), gapRu: ru === null ? null : Math.abs(p - ru) });
      counts[band]++;
    }
    return { byCountry, counts, total: byCountry.size, usChinaGap: Math.abs(us - cn) };
  }, [data, idx, year]);

  const groupColorFor = useCallback(
    (code: string) => {
      if (code === 'CN') return BAND_COLORS.china;
      const b = view?.byCountry.get(code);
      return b ? BAND_COLORS[b.band] : null;
    },
    [view],
  );
  const describe = useCallback(
    (code: string) => {
      const name = nameFor(code);
      if (code === 'US') return 'United States: one end of this map.';
      if (code === 'CN') return 'China: the other end of this map.';
      const b = view?.byCountry.get(code);
      if (!b) return `${name}: no General Assembly vote recorded in ${year}`;
      const ru = b.gapRu === null ? '' : `, Russia ${b.gapRu.toFixed(2)}`;
      return `${name}, ${year}: ${BAND_LABELS[b.band].toLowerCase()}. Gap from the United States ${b.gapUs.toFixed(2)}, China ${b.gapCn.toFixed(2)}${ru}`;
    },
    [view, year],
  );

  if (failed) return <p className="text-sm text-ink-faint">Couldn't load the UN voting data.</p>;
  if (!data || data.years.length === 0) return <p className="text-sm text-ink-faint">{data ? 'The UN voting data has not been loaded yet.' : 'Loading…'}</p>;

  return (
    <div className="card min-w-0 overflow-hidden px-0 pb-4 pt-0">
      <div className="stage relative isolate bg-hero-bg px-3 pb-4 pt-5 text-hero-ink">
        <div className="mx-auto w-full max-w-[560px]">
          <Suspense fallback={<div className="mx-auto aspect-square w-full rounded-full border border-hero-border" aria-hidden="true" />}>
            <PulseGlobe
              plain
              breakdown={[]}
              activeCountry={null}
              onSelect={() => undefined}
              groupColorFor={groupColorFor}
              describe={describe}
              hint="Move over a country to see how it votes. Drag to turn the globe."
              ariaLabel={`Globe of United Nations General Assembly voting in ${year}, with each country colored by where its votes fall between the United States and China`}
              legend={BANDS.map((b) => ({ swatch: BAND_COLORS[b], label: BAND_LABELS[b] }))}
            />
          </Suspense>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label htmlFor="un-year" className="text-sm font-semibold text-ink">
            Year: <span className="tabular-nums">{year}</span>
          </label>
          <input
            id="un-year"
            type="range"
            min={0}
            max={data.years.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setYearIdx(Number(e.target.value))}
            aria-valuetext={String(year)}
            className="min-w-[10rem] flex-1 accent-[var(--color-accent)]"
          />
          <span className="text-xs text-ink-faint">
            {data.years[0]} to {data.years[data.years.length - 1]}
          </span>
        </div>

        {view ? (
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted" aria-live="polite">
            In {year}, of {view.total} other countries with a recorded vote, {view.counts.us + view.counts.leanUs} voted nearer the United States' position, {view.counts.china + view.counts.leanChina}{' '}
            nearer China's, and {view.counts.middle} about halfway between. The two sit {view.usChinaGap.toFixed(2)} apart on the voting scale that year.
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-ink-faint">There are no positions for the United States and China in {year}.</p>
        )}
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-faint">
          Each country is placed by how its votes on resolutions that reached a recorded vote line up along the main dividing line in the Assembly, then shown by where that falls between the
          United States' position and China's that year. Being nearer China's position does not mean voting like China: when the United States sits far out at one end of the scale, most
          countries fall nearer the other end, so a map like this says as much about where the United States stands as about China. The slider moves the two powers as well as the countries.
          This is behavior, not influence: countries can vote alike for reasons that have nothing to do with the powers named.
        </p>
        <ChartFooter
          source="Bailey, Strezhnev and Voeten, UN General Assembly ideal points (Harvard Dataverse, CC0)"
          sourceUrl="https://doi.org/10.7910/DVN/LEJUQZ"
          asOf={data.asOf?.slice(0, 10)}
          csv={
            view
              ? {
                  filename: `aex-terminal-un-voting-${year}.csv`,
                  header: ['Country', 'Placement', 'Gap from United States', 'Gap from China', 'Gap from Russia'],
                  rows: [...view.byCountry.entries()].map(([cc, b]) => [nameFor(cc), BAND_LABELS[b.band], b.gapUs.toFixed(3), b.gapCn.toFixed(3), b.gapRu === null ? '' : b.gapRu.toFixed(3)]),
                }
              : undefined
          }
        />
        <details className="mt-2 text-xs text-ink-faint">
          <summary className="cursor-pointer font-semibold hover:text-ink">How to cite</summary>
          <p className="mt-1.5">
            Bailey, Michael A., Anton Strezhnev, and Erik Voeten. 2017. "Estimating Dynamic State Preferences from United Nations Voting Data." Journal of Conflict Resolution 61 (2): 430-456.
          </p>
        </details>
      </div>
    </div>
  );
}
