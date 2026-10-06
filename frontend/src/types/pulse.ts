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

// GTA ("Global Trade Alert") rows: a foreign government's own trade measure
// affecting the U.S. -- independent research data, not a U.S. government
// source (see CountryDetail.tsx's panel copy for the disclosure shown with
// every one of these).
export interface GtaInterventionRow {
  intervention_id: number;
  state_act_title: string;
  intervention_url: string;
  state_act_url?: string;
  gta_evaluation: 'Red' | 'Amber' | 'Green';
  implementing_jurisdictions?: { id: number; name: string; iso: string }[];
  implementing_jurisdiction_groups?: { name: string }[] | null;
  intervention_type: string;
  mast_chapter?: string;
  date_announced: string | null;
  date_implemented?: string | null;
  date_removed?: string | null;
  is_in_force?: number;
}

// CBP Withhold Release Orders & Findings (Section 307 forced-labor
// enforcement) rows naming this country -- a real CBP data feed, distinct
// from the DHS UFLPA Entity List this app links to rather than ingests (see
// CountryDetail.tsx's panel copy).
export interface WroFindingRow {
  id: number;
  effective_date: string | null;
  merchandise: string | null;
  order_type: 'WRO' | 'Finding';
  status: string;
  entity: string | null;
  remarks: string | null;
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
  retaliatoryMeasures: { rows: GtaInterventionRow[]; total: number; note: string };
  forcedLaborEnforcement: { rows: WroFindingRow[]; total: number; note: string };
  // Region/income/capital/population/GDP baseline (migration 0022, World
  // Bank) -- null only for the handful of codes the World Bank itself has
  // no entry for (see that migration's comment), never fabricated.
  snapshot: CountrySnapshot | null;
}

export interface CountrySnapshot {
  region: string;
  incomeLevel: string;
  capitalCity: string | null;
  population: number | null;
  populationYear: string | null;
  gdpUsd: number | null;
  gdpYear: string | null;
  sourceUrl: string;
  lastUpdated: string;
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

// --- Cross-topic connections (src/routes/pulseConnections.ts) ----------------

export type ConnectionKind = 'action' | 'news' | 'gta' | 'wro' | 'sanction';

export interface ConnectionReaction {
  seriesId: string;
  label: string;
  /** Plain-words reading, e.g. "CNY weakened 0.4% against the dollar". */
  reading: string;
  changePct: number;
  beforeDate: string;
  afterDate: string;
}

export interface ConnectionEvent {
  kind: ConnectionKind;
  id: string;
  date: string;
  title: string;
  url: string | null;
  source: string | null;
  countries: string[];
  topics: string[];
  reactions: ConnectionReaction[];
}

export interface ConnectionsResponse {
  country: string | null;
  countries: string[];
  days: number;
  topic: string | null;
  events: ConnectionEvent[];
  topicCounts: { topic: string; count: number }[];
  /** Items left out of the default view per source, e.g. { action: 72 }. */
  omitted: Partial<Record<ConnectionKind, number>>;
  reactionNote: string;
}

export interface RelatedLinkItem {
  event: Omit<ConnectionEvent, 'reactions'>;
  score: number;
  reason: string;
  sharedTopics: string[];
  daysApart: number;
}

export interface RelatedResponse {
  subject: { kind: ConnectionKind; id: string; topics: string[]; countries: string[] };
  windowDays: number;
  links: RelatedLinkItem[];
}

export interface ConvergenceRow {
  country: string;
  kinds: Partial<Record<ConnectionKind, number>>;
  sourceCount: number;
  topics: { topic: string; count: number }[];
  total: number;
  latest: Omit<ConnectionEvent, 'reactions'>;
}

export interface ConvergenceResponse {
  days: number;
  rows: ConvergenceRow[];
  note: string;
}
