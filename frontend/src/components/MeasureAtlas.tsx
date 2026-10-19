import { lazy, Suspense, useCallback, useMemo } from 'react';
import { divergingBanding, NO_DATA_COLOR, sequentialBanding, type AtlasKind } from '../lib/atlasBands';
import { nameFor } from '../lib/powerCountries';

// Loaded on its own so the map library does not slow the rest of the page.
const PulseGlobe = lazy(() => import('./PulseGlobe').then((m) => ({ default: m.PulseGlobe })));

export interface AtlasMeasure {
  id: string;
  label: string;
  kind: AtlasKind;
  /** Country code -> value (for a categorical map, the index into `classes`). A country missing here has no reading, which the map and its legend say. */
  values: Record<string, number>;
  /** Categorical maps only: the named classes and their colors. */
  classes?: { color: string; label: string }[];
  /** The value as a reader sees it, with its unit. */
  format: (v: number) => string;
  /** Diverging only: the two sides and the gap sizes (in the measure's unit) for "about even" and "far more". */
  diverging?: { left: string; right: string; near: number; edge: number };
  /** Year or survey date shown with the numbers. */
  asOf?: string | null;
}

const rankOf = (values: Record<string, number>, code: string) => {
  const v = values[code];
  return Object.values(values).filter((x) => x > v).length + 1;
};

// A globe shaded by one measure, with a legend that names every class (including "no data"), a sentence on hover, and the same
// numbers as a table for anyone who cannot use the map. It never ranks or scores countries across measures; each map is one measure.
export function MeasureAtlas({
  measure,
  activeCountry,
  onSelect,
  compact = false,
}: {
  measure: AtlasMeasure;
  activeCountry: string | null;
  onSelect: (code: string) => void;
  compact?: boolean;
}) {
  const entries = useMemo(() => Object.entries(measure.values).filter(([, v]) => Number.isFinite(v)), [measure.values]);
  const banding = useMemo(() => {
    if (measure.kind === 'categorical' && measure.classes) {
      const classes = measure.classes;
      return { classOf: (v: number) => Math.max(0, Math.min(classes.length - 1, Math.round(v))), classes };
    }
    if (measure.kind === 'diverging' && measure.diverging) {
      const d = measure.diverging;
      return divergingBanding(d.near, d.edge, d.left, d.right);
    }
    return sequentialBanding(entries.map(([, v]) => v), measure.format);
  }, [measure, entries]);

  const groupColorFor = useCallback(
    (code: string) => {
      const v = measure.values[code];
      return v === undefined ? NO_DATA_COLOR : banding.classes[banding.classOf(v)].color;
    },
    [measure, banding],
  );
  const describe = useCallback(
    (code: string) => {
      const v = measure.values[code];
      if (v === undefined) return `${nameFor(code)}: no reading for this measure`;
      return `${nameFor(code)}: ${measure.format(v)}${measure.kind === 'sequential' ? `, ${rankOf(measure.values, code)} of ${entries.length}` : ''}`;
    },
    [measure, entries.length],
  );

  const table = useMemo(() => [...entries].sort((a, b) => b[1] - a[1]), [entries]);

  return (
    <div className="min-w-0">
      <div className={`stage relative isolate overflow-hidden rounded-sm bg-hero-bg px-2 pb-3 pt-3 text-hero-ink ${compact ? '' : 'sm:px-4'}`}>
        <div className={`mx-auto w-full ${compact ? 'max-w-[520px]' : 'max-w-[640px]'}`}>
          <Suspense fallback={<div className="mx-auto aspect-square w-full rounded-full border border-hero-border" aria-hidden="true" />}>
            <PulseGlobe
              plain
              breakdown={[]}
              activeCountry={activeCountry}
              onSelect={onSelect}
              groupColorFor={groupColorFor}
              describe={describe}
              hint="Move over a country to read its value. Drag to turn the globe."
              ariaLabel={`Globe shaded by ${measure.label}. ${entries.length} countries have a reading; the same numbers are in the table below the map.`}
              legend={[...banding.classes.map((c) => ({ swatch: c.color, label: c.label })), { swatch: NO_DATA_COLOR, label: 'No reading' }]}
            />
          </Suspense>
        </div>
      </div>
      <details className="mt-2 text-xs text-ink-faint">
        <summary className="cursor-pointer font-semibold hover:text-ink">The same numbers as a table ({entries.length} countries)</summary>
        <div className="mt-2 max-h-64 overflow-auto border border-hairline">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">{measure.label}, by country</caption>
            <thead className="sticky top-0 bg-paper-raised text-ink-faint">
              <tr>
                <th scope="col" className="px-2 py-1 font-semibold">Country</th>
                <th scope="col" className="px-2 py-1 font-semibold">{measure.label}</th>
              </tr>
            </thead>
            <tbody>
              {table.map(([cc, v]) => (
                <tr key={cc} className="border-t border-hairline/60">
                  <th scope="row" className="px-2 py-1 font-normal text-ink-muted">{nameFor(cc)}</th>
                  <td className="px-2 py-1 tabular-nums text-ink">{measure.format(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
