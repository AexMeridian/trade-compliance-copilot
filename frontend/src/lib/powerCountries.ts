import { WORLD_COUNTRIES } from './worldCountries';

// The countries the Power profile can compare: every country the globe draws, plus the United States as a first-class
// choice (the trade view leaves it out because U.S. policy is what that view measures). Names come from the same
// single source as the globe; only the long official form of the U.S. is shortened.
export const POWER_LABELS: Record<string, string> = Object.fromEntries(
  WORLD_COUNTRIES.map((c) => [c.code, c.code === 'US' ? 'United States' : c.name]),
);

export const POWER_CODES = Object.keys(POWER_LABELS).sort((a, b) => POWER_LABELS[a].localeCompare(POWER_LABELS[b]));

/** One distinguishable color per selected country, all theme-aware (the "-ink" tokens are re-tuned for dark mode). */
export const SERIES_COLORS = ['var(--color-hue-indigo-ink)', 'var(--color-hue-orange-ink)', 'var(--color-hue-cyan-ink)', 'var(--color-hue-pink-ink)'];

// Countries the globe does not draw (small states) still deserve a name, not a bare code.
const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function nameFor(code: string): string {
  if (POWER_LABELS[code]) return POWER_LABELS[code];
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}
