// Plain statistics for the resources-versus-opinion chart. Pure functions, unit-tested in tests/opinion.test.ts.

/** Average ranks (1 = smallest); tied values share the mean of the ranks they span. */
export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k][1]] = avg;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation: how consistently two series rise together, without assuming a straight line. Null when undefined. */
export function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rx = ranks(xs);
  const ry = ranks(ys);
  const n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}

export type AlignmentBand = 'china' | 'leanChina' | 'middle' | 'leanUs' | 'us';
export const BAND_LABELS: Record<AlignmentBand, string> = {
  china: "At China's end",
  leanChina: "Nearer China's position",
  middle: 'About halfway',
  leanUs: "Nearer the U.S. position",
  us: "At the U.S. end",
};

/**
 * Where `position` falls on the line from `from` (0) to `to` (1). Values outside the two ends are not clipped, so a country
 * beyond either power is still distinguishable by callers that want it; `alignmentBand` does the grouping.
 */
export function positionBetween(position: number, from: number, to: number): number {
  const span = to - from;
  return span === 0 ? 0.5 : (position - from) / span;
}

/** Five groups along the line from China (0) to the United States (1): the outer two cover everything at or beyond 0.2 / 0.8. */
export function alignmentBand(t: number): AlignmentBand {
  if (t < 0.2) return 'china';
  if (t < 0.4) return 'leanChina';
  if (t <= 0.6) return 'middle';
  if (t <= 0.8) return 'leanUs';
  return 'us';
}
