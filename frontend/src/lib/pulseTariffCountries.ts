import { COUNTRY_LABELS } from './pulseCountries';

// Display names for the Section 301 forced-labor list (60 economies --
// migrations/0008_seed_tariff_overlays_301.sql) that COUNTRY_LABELS can't
// supply. COUNTRY_LABELS now covers every country the bundled globe map
// draws (lib/worldCountries.ts), which is nearly all of this tariff list --
// what's left here is only the handful of real, tariff-tracked
// jurisdictions too small to appear in that map's 1:110m resolution at all
// (so they're also never clickable on the globe itself), plus Hong Kong,
// which the map draws as part of China's outline rather than its own
// feature. Standard ISO/common names, real and unambiguous, not derived
// from any feed.
const TARIFF_ONLY_LABELS: Record<string, string> = {
  LI: 'Liechtenstein',
  BH: 'Bahrain',
  HK: 'Hong Kong',
  SG: 'Singapore',
};

export const TARIFF_COUNTRY_LABELS: Record<string, string> = { ...COUNTRY_LABELS, ...TARIFF_ONLY_LABELS };
