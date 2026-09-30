// Mirrors src/lib/pulse/types.ts on the backend (Worker) -- same
// duplicate-not-import convention as types/case.ts, see its header comment.

export type PulseTag = 'Tariff' | 'Sanctions' | 'Export Control' | 'Trade Agreement' | 'Other';

export interface PulseAction {
  document_number: string;
  title: string;
  abstract: string | null;
  agency: string;
  doc_type: string;
  publication_date: string;
  tag: PulseTag;
  html_url: string;
  fetched_at: string;
  effective_on: string | null;
  comments_close_on: string | null;
  citation: string | null;
  countries: string | null; // JSON array of country codes, e.g. "[\"CN\",\"MX\"]" -- see lib/pulseCountries.ts
}

export interface TempoPoint {
  month: string;
  count: number;
}

// Computed entirely with SQL aggregation in routes/pulse.ts -- no LLM
// involved. The interpretation layer for the dashboard's headline stats.
export interface PulseSummary {
  last30: number;
  prior30: number;
  trendPct: number | null; // null when there's no prior-period baseline to compare against
  last90: number;
  prior90: number;
  trendPct90: number | null; // same shape as trendPct, over a 90-vs-prior-90-day window
  leadingTag: PulseTag | null;
  leadingTagCount: number;
  leadingTagShare: number | null; // % of last30 that leadingTag accounts for
  newMeasures90d: number;
  totalTracked: number;
  openForComment: number;
  agencyBreakdown: { agency: string; count: number }[];
  countryBreakdown: { country: string; count: number }[];
  countryTariffs: {
    forcedLabor: { country: string; ratePct: number; sourceUrl: string; asOf: string }[];
    extra: { country: string; ratePct: number; program: string; note: string; sourceUrl: string }[];
    capped: { country: string; ratePct: number; standardPct: number | null; program: string; note: string; sourceUrl: string }[];
  };
}

// One row per real-world measure (aggregated server-side from the
// HTS-line/country-granular tariff_overlays table -- see routes/pulse.ts).
export interface ActiveMeasure {
  program: string;
  legal_basis: string;
  rate_type: string;
  min_rate_pct: number | null;
  max_rate_pct: number | null;
  line_count: number;
  sample_hts: string;
  country_count: number;
  sample_scope: string | null;
  effective_date: string;
  expiration_date: string | null;
  source_url: string;
  data_as_of: string;
}

export interface MarketTile {
  id: string;
  label: string;
  group: 'U.S. stocks' | 'World stocks' | 'Trade bellwethers' | 'Commodities' | 'Rates & dollar' | 'Macro';
  unit: string;
  source: string;
  sourceUrl: string;
  value: number;
  asOf: string;
  change: number | null;
  changePct: number | null; // only for level-type series (index, price); null for rates/balances
  changeMode: 'percent' | 'absolute';
  yoyChangePct: number | null; // Macro group only: year-over-year, the standard way these are reported elsewhere
  points: [string, number][]; // [ISO date, close] -- ~3 months of daily closes for markets, up to 3 years of monthly points for Macro
}

export interface CurrencyRow {
  quote: string;
  label: string; // e.g. "USD/EUR"
  rate: number; // units of the quote currency per 1 USD
  asOf: string;
  change30dPct: number | null;
  spark: number[]; // oldest to newest, up to 30 points
}

export interface PulseMarkets {
  tiles: MarketTile[];
  currencies: CurrencyRow[];
}

export type NewsCategory = 'Trade & Supply Chain' | 'Markets & Currency' | 'Elections & Politics' | 'Official';

export interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  category: NewsCategory;
  countries: string | null; // JSON array of country codes
  published_at: string;
  image_url: string | null; // lead image from the publisher's own feed/CDN, if it supplies one
}

// GET /api/pulse/country/:code -- everything real, sourced data this app has
// about one country. duty_stack lines use the same DutyStackLine shape as
// types/case.ts (mirrored, not imported, same convention as this file's
// header comment) so DutyStackTable can render them unmodified.
export interface CountryDutyStackHeading {
  htsno: string;
  label: string;
  description: string | null;
  totalPct: number | null;
  lines: import('./case').DutyStackLine[];
  error: string | null;
}

export interface CountryChartRow {
  id: number;
  country_code: string;
  reason_for_control: string;
  control_level: string;
  source_url: string;
  source_tier: number;
  last_updated: string;
}

export interface PulseCountryDetail {
  code: string;
  actions: PulseAction[];
  tempo: TempoPoint[];
  tariffs: {
    forcedLabor: { ratePct: number; sourceUrl: string; asOf: string; legalBasis: string } | null;
    extra: { ratePct: number; sourceUrl: string; legalBasis: string; asOf: string; note: string }[];
    capped: { ratePct: number; standardPct: number | null; sourceUrl: string; legalBasis: string; note: string } | null;
  };
  dutyStack: CountryDutyStackHeading[];
  exportControl: {
    status: 'curated' | 'comprehensive_embargo' | 'broad_restriction_746_5' | 'not_curated';
    notes: string | null;
    sourceUrl: string | null;
    lastUpdated: string | null;
    rows: CountryChartRow[];
  };
  sanctions: { sdnCount: number | null; cslCount: number | null; note: string };
}

export interface PulseHome {
  summary: PulseSummary | null;
  tempo: { months: TempoPoint[] } | null;
  overlays: { overlays: ActiveMeasure[] } | null;
  recent: { actions: PulseAction[] } | null;
  markets: PulseMarkets | null;
  news: PulseNewsResponse | null;
  // When each source last refreshed successfully (ISO), or null if never / switched off.
  status: { policy: string | null; news: string | null; quotes: string | null; fx: string | null; macro: string | null };
}

export interface PulseNewsResponse {
  items: NewsItem[];
  counts: Partial<Record<NewsCategory, number>>;
  lastSuccessAt: string | null;
  note: string | null;
}
