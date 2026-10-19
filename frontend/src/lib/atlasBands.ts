// Turning one measure's values (country code -> number) into the colored classes an atlas map shows. Two kinds, following the rule
// that color encodes one job: a SEQUENTIAL measure (more of something) uses one hue in five steps from dim to bright, split at
// quintiles of the values actually present; a DIVERGING measure (one side ahead of the other, such as views of the U.S. against
// views of China) uses two hues with a neutral middle and fixed, symmetric thresholds. No data is its own neutral class and is
// always named in the legend, never left as an unexplained blank.

export type AtlasKind = 'sequential' | 'diverging' | 'categorical';

export interface AtlasClass {
  color: string;
  label: string;
}

// Single-hue (teal) ramp for the always-dark atlas stage: lowest class dimmest, highest brightest, each step clearly lighter.
export const SEQUENTIAL_RAMP = ['#134e5e', '#14788d', '#1aa6b9', '#5fd0dd', '#c8f2f6'];
// Orange <-> blue with a neutral gray middle (the same pair the UN-voting map uses): left side first.
export const DIVERGING_RAMP = ['#f97316', '#fdba74', '#a8a29e', '#93c5fd', '#3b82f6'];
export const NO_DATA_COLOR = '#2b3340';

export interface Banding {
  /** Class index 0..4 for a value. */
  classOf: (v: number) => number;
  classes: AtlasClass[];
}

/** Quintile breaks over the values present (so each class holds about a fifth of the countries). */
export function quintileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
}

export function sequentialBanding(values: number[], format: (v: number) => string): Banding {
  // Break at quintiles, but only at distinct values: when many countries tie (whole percentages near zero), fewer classes are used
  // rather than legend entries that read "0% to 0%".
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const cuts = [...new Set(quintileBreaks(values))].filter((b) => b > lo && b <= hi);
  const edges = [lo, ...cuts, hi];
  const n = cuts.length + 1;
  // Spread the classes over the five-step ramp so a map with three classes still runs from dim to bright.
  const ramp = Array.from({ length: n }, (_, i) => SEQUENTIAL_RAMP[n === 1 ? 2 : Math.round((i * (SEQUENTIAL_RAMP.length - 1)) / (n - 1))]);
  const classOf = (v: number) => {
    let i = 0;
    while (i < cuts.length && v >= cuts[i]) i++;
    return i;
  };
  const classes = ramp.map((color, i) => ({
    color,
    label: edges[i] === edges[i + 1] ? format(edges[i]) : i === n - 1 ? `${format(edges[i])} to ${format(edges[i + 1])}` : `${format(edges[i])} to under ${format(edges[i + 1])}`,
  }));
  return { classOf, classes };
}

/** `edge` is the gap (in the measure's own unit) that counts as a clear lead; `near` the gap under which the two are about even. */
export function divergingBanding(near: number, edge: number, leftName: string, rightName: string): Banding {
  const classOf = (v: number) => (v <= -edge ? 0 : v < -near ? 1 : v <= near ? 2 : v < edge ? 3 : 4);
  const classes: AtlasClass[] = [
    { color: DIVERGING_RAMP[0], label: `Far more ${leftName}` },
    { color: DIVERGING_RAMP[1], label: `More ${leftName}` },
    { color: DIVERGING_RAMP[2], label: 'About even' },
    { color: DIVERGING_RAMP[3], label: `More ${rightName}` },
    { color: DIVERGING_RAMP[4], label: `Far more ${rightName}` },
  ];
  return { classOf, classes };
}
