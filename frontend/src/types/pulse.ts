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
  leadingTag: PulseTag | null;
  leadingTagCount: number;
  leadingTagShare: number | null; // % of last30 that leadingTag accounts for
  newMeasures90d: number;
  totalTracked: number;
  openForComment: number;
  agencyBreakdown: { agency: string; count: number }[];
  countryBreakdown: { country: string; count: number }[];
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
  group: 'U.S. stocks' | 'World stocks' | 'Trade bellwethers' | 'Commodities' | 'Rates & dollar';
  unit: string;
  source: string;
  sourceUrl: string;
  value: number;
  asOf: string;
  change: number | null;
  changePct: number | null; // only for level-type series (index, price); null for rates/balances
  changeMode: 'percent' | 'absolute';
  points: [string, number][]; // [ISO date, close], oldest first, ~3 months of daily closes
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

export interface PulseHome {
  summary: PulseSummary | null;
  tempo: { months: TempoPoint[] } | null;
  overlays: { overlays: ActiveMeasure[] } | null;
  recent: { actions: PulseAction[] } | null;
  markets: PulseMarkets | null;
  news: PulseNewsResponse | null;
  // When each source last refreshed successfully (ISO), or null if never / switched off.
  status: { policy: string | null; news: string | null; quotes: string | null; fx: string | null };
}

export interface PulseNewsResponse {
  items: NewsItem[];
  counts: Partial<Record<NewsCategory, number>>;
  lastSuccessAt: string | null;
  note: string | null;
}
