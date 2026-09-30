// Shared globe-coloring helpers for any hero that recolors PulseGlobe by
// alliance membership instead of by mention count -- factored out of
// InfluenceHero.tsx so PowerHero.tsx doesn't duplicate the same lookup and
// legend. Bloc membership itself (real, public, sourced) lives in
// pulseBlocs.ts; this file only maps that data to display color/legend.
import { BLOC_LABELS, primaryBlocFor, type Bloc } from './pulseBlocs';
import { BLOC_HUE, UNALIGNED_HUE } from './pulseColors';

export const BLOC_GLOBE_LEGEND = [
  ...Object.entries(BLOC_HUE).map(([bloc, hue]) => ({ swatch: hue.css, label: BLOC_LABELS[bloc as Bloc] })),
  { swatch: UNALIGNED_HUE.css, label: 'No tracked bloc' },
];

export function blocGroupColorFor(code: string): string | null {
  const bloc = primaryBlocFor(code);
  return bloc ? BLOC_HUE[bloc].css : null;
}
