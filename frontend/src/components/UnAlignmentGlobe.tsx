import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getUnAlignment, type UnAlignment } from '../lib/api';
import { nameFor } from '../lib/powerCountries';
import { alignmentBand, BAND_LABELS, BAND_THRESHOLDS, positionBetween, type AlignmentBand } from '../lib/powerStats';
import { WORLD_COUNTRIES } from '../lib/worldCountries';
import { ChartFooter } from './ChartFooter';

// Loaded on its own so the map library does not slow the rest of the page.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

// One color per band, from China's end (orange) through the middle (neutral) to the United States' end (blue).
const BAND_COLORS: Record<AlignmentBand, string> = {
  beyondChina: '#c2410c',
  china: '#f97316',
  leanChina: '#fdba74',
  middle: '#a8a29e',
  leanUs: '#93c5fd',
  us: '#3b82f6',
  beyondUs: '#1d4ed8',
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
    const counts: Record<AlignmentBand, number> = { beyondChina: 0, china: 0, leanChina: 0, middle: 0, leanUs: 0, us: 0, beyondUs: 0 };
    for (const c of WORLD_COUNTRIES) {
      const p = at(c.code);
      if (p === null || c.code === 'US' || c.code === 'CN') continue;
      const band = alignmentBand(positionBetween(p, cn, us));
      byCountry.set(c.code, { band, gapUs: Math.abs(p - us), gapCn: Math.abs(p - cn), gapRu: ru === null ? null : Math.abs(p - ru) });
      counts[band]++;
    }
    return { byCountry, counts, total: byCountry.size, usChinaGap: Math.abs(us - cn), us, cn };
  }, [data, idx, year]);

  // The two powers' own positions over time, so a reader can see which one moved when the slider moves.
  const trend = useMemo(() => {
    if (!data) return null;
    const us = data.positions['US'] ?? [];
    const cn = data.positions['CN'] ?? [];
    const vals = [...us, ...cn].filter((v): v is number => typeof v === 'number');
    if (vals.length < 4) return null;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const n = data.years.length;
    const x = (i: number) => (n <= 1 ? 50 : 4 + (i / (n - 1)) * 92);
    const y = (v: number) => 94 - ((v - lo) / (hi - lo || 1)) * 88;
    const path = (arr: (number | null | undefined)[]) =>
      arr.map((v, i) => (typeof v === 'number' ? `${i === 0 || typeof arr[i - 1] !== 'number' ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}` : '')).join(' ');
    return { us: path(us), cn: path(cn), x };
  }, [data]);

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
      if (code === 'US') return 'United States: the reference point on one side of this map.';
      if (code === 'CN') return 'China: the reference point on the other side of this map.';
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
    <div className="min-w-0">
      <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">Read this first.</span> The scale behind this map is mostly a split between Western democracies and the developing-world majority in General Assembly votes (including on
        Israel-Palestine and decolonization). It is not a measure of closeness to China: China sits where it does because it votes with the developing-world majority, and "nearer China" mostly means "less like the
        United States". It shows voting behavior, not influence.
      </p>
      <div className="stage un-stage relative isolate overflow-hidden rounded-2xl px-3 pb-6 pt-6 text-hero-ink sm:px-8">
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
              ariaLabel={`Globe of the main dimension of United Nations General Assembly voting in ${year}, with each country colored by where its position falls relative to the United States and China`}
              legend={BANDS.map((b) => ({ swatch: BAND_COLORS[b], label: BAND_LABELS[b] }))}
            />
          </Suspense>
        </div>
        <div className="mx-auto mt-5 flex max-w-xl flex-wrap items-center gap-x-4 gap-y-2 border-t border-hero-divider pt-4">
          <label htmlFor="un-year" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-hero-ink-muted">
            Year <span className="ml-1 text-lg tracking-normal tabular-nums text-hero-ink">{year}</span>
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
            className="min-w-[10rem] flex-1 accent-[var(--color-hero-btn-bg)]"
          />
          <span className="text-xs tabular-nums text-hero-ink-faint">
            {data.years[0]} to {data.years[data.years.length - 1]}
          </span>
        </div>
        <p className="mx-auto mt-2 max-w-xl text-[11px] leading-snug text-hero-ink-faint">
          The slider changes the year for every country and for the United States and China themselves: both reference points move too.
          {view ? ` In ${year}: U.S. ${view.us.toFixed(2)}, China ${view.cn.toFixed(2)} on the scale.` : ''}
        </p>
        {trend && (
          <figure className="mx-auto mt-2 max-w-xl">
            <svg role="img" aria-label="Line chart of the United States' and China's positions on the UN voting scale by year" viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
              <path d={trend.us} fill="none" stroke={BAND_COLORS.us} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
              <path d={trend.cn} fill="none" stroke={BAND_COLORS.china} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
              <line x1={trend.x(idx)} x2={trend.x(idx)} y1="0" y2="100" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <figcaption className="flex gap-4 text-[11px] text-hero-ink-faint">
              <span><span style={{ color: BAND_COLORS.us }}>&#9632;</span> United States</span>
              <span><span style={{ color: BAND_COLORS.china }}>&#9632;</span> China</span>
              <span>Position on the voting scale, {data.years[0]} to {data.years[data.years.length - 1]}</span>
            </figcaption>
          </figure>
        )}
      </div>

      <div className="px-1 pt-5 sm:px-2">
        {view ? (
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted" aria-live="polite">
            In {year}, of {view.total} other countries with a recorded vote, {view.counts.us + view.counts.leanUs + view.counts.beyondUs} sat nearer the United States' position, {view.counts.china + view.counts.leanChina + view.counts.beyondChina}{' '}
            nearer China's, and {view.counts.middle} about halfway between. The two sit {view.usChinaGap.toFixed(2)} apart on the voting scale that year.
          </p>
        ) : (
          <p className="mt-3 text-[13px] text-ink-faint">There are no positions for the United States and China in {year}.</p>
        )}
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-ink-faint">
          Each country is placed by how its votes on resolutions that reached a recorded vote line up along the main dividing line in the Assembly (the IdealPointFP estimate), then grouped by where that falls on the line
          from China's position (0) to the United States' (1) that year. Groups are equal fifths of that distance, cut at {BAND_THRESHOLDS.join(', ')}; a country below 0 or above 1 lies past the named
          power's own position and is labelled "beyond", not "at" that end. The cut points are for readability, not statistical breaks. When the United States sits far out at one end of the scale, most countries
          fall nearer the other end, so the map says as much about where the United States stands as about China. The data end in {data.years[data.years.length - 1]}; later General Assembly sessions are not yet in the dataset.
          Percentage agreement with the United States or China on recorded votes is a simpler measure, but it is not loaded here; this map uses the model-based position only.
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
