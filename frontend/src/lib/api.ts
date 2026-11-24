import type { CaseFile, Direction, OriginComponent, PartyRole, Verdict } from '../types/case';
import type { PulseHome, PulseAction, PulseCountryDetail, PulseMarkets, PulseNewsResponse, TempoPoint, ConnectionsResponse, RelatedResponse, ConvergenceResponse } from '../types/pulse';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// The secret that lets the browser which created a case delete it early is kept only here, in
// this browser's local storage; the server stores just a hash of it.
const tokenKey = (id: string) => `caseToken:${id}`;
export function hasCaseToken(id: string): boolean {
  try {
    return !!localStorage.getItem(tokenKey(id));
  } catch {
    return false;
  }
}

// The token is also kept in memory for this page load, so a browser that blocks local storage can still finish a case it just started.
const memoryTokens = new Map<string, string>();
/** The header that lets this browser add to a case it created: the server accepts module requests for a case only with the case's secret token. */
function caseHeaders(id: string): Record<string, string> {
  let token = memoryTokens.get(id) ?? '';
  try {
    token = localStorage.getItem(tokenKey(id)) ?? token;
  } catch {
    // storage blocked: use the in-memory copy
  }
  return token ? { 'X-Delete-Token': token } : {};
}

export async function createCase(direction: Direction) {
  const res = await request<{ id: string; case_file: CaseFile; delete_token?: string; retention_days?: number }>('/cases', {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
  if (res.delete_token) memoryTokens.set(res.id, res.delete_token);
  try {
    if (res.delete_token) localStorage.setItem(tokenKey(res.id), res.delete_token);
  } catch {
    // Storage blocked: the case still works and expires on schedule; it just cannot be deleted early from here.
  }
  return res;
}

export async function deleteCase(id: string) {
  let token = '';
  try {
    token = localStorage.getItem(tokenKey(id)) ?? '';
  } catch {
    // fall through with an empty token; the server will refuse
  }
  const out = await request<{ deleted: boolean }>(`/cases/${id}`, { method: 'DELETE', headers: { 'X-Delete-Token': token } });
  try {
    localStorage.removeItem(tokenKey(id));
  } catch {
    // ignore
  }
  return out;
}

export function getCase(id: string) {
  return request<{ case_file: CaseFile }>(`/cases/${id}`);
}

export function getReport(id: string) {
  return request<{ case_file: CaseFile; verdict: Verdict; generated_at: string }>(`/cases/${id}/report`);
}

export function listSamples() {
  return request<{ samples: { id: string; direction: Direction; sample_key: string; product_description: string }[] }>('/cases/samples');
}

export function submitClassification(id: string, productDescription: string) {
  return request<{ classification: CaseFile['classification'] }>(`/cases/${id}/classification`, {
    method: 'POST',
    headers: caseHeaders(id),
    body: JSON.stringify({ product_description: productDescription }),
  });
}

export function submitOrigin(id: string, components: OriginComponent[], finalAssemblyCountry: string) {
  return request<{ origin: CaseFile['origin'] }>(`/cases/${id}/origin`, {
    method: 'POST',
    headers: caseHeaders(id),
    body: JSON.stringify({ components, final_assembly_country: finalAssemblyCountry }),
  });
}

export function submitScreening(id: string, parties: { role: PartyRole; name: string }[], deemedExportFlag?: boolean) {
  return request<{ screening: CaseFile['screening'] }>(`/cases/${id}/screening`, {
    method: 'POST',
    headers: caseHeaders(id),
    body: JSON.stringify({ parties, deemed_export_flag: deemedExportFlag }),
  });
}

export function submitDetermination(id: string, opts: { destinationCountry?: string; declaredValueUsd?: number; entryDate?: string; transportMode?: string } = {}) {
  return request<{ determination: CaseFile['determination'] }>(`/cases/${id}/determination`, {
    method: 'POST',
    headers: caseHeaders(id),
    body: JSON.stringify({ destination_country: opts.destinationCountry, declared_value_usd: opts.declaredValueUsd, entry_date: opts.entryDate, transport_mode: opts.transportMode }),
  });
}

export function getPulseFeed(limit?: number, tag?: string, opts?: { search?: string; country?: string }) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (tag) params.set('tag', tag);
  if (opts?.search) params.set('q', opts.search);
  if (opts?.country) params.set('country', opts.country);
  const qs = params.toString();
  return request<{ actions: PulseAction[] }>(`/pulse/feed${qs ? `?${qs}` : ''}`);
}

export function getPulseHome() {
  return request<PulseHome>('/pulse/home');
}

export function getPulseTempo(months?: number) {
  return request<{ months: TempoPoint[] }>(`/pulse/tempo${months ? `?months=${months}` : ''}`);
}

export function getPulseCountry(code: string, name?: string) {
  return request<PulseCountryDetail>(`/pulse/country/${code}${name ? `?name=${encodeURIComponent(name)}` : ''}`);
}

export interface TariffOverlayRow {
  program: string;
  hts_pattern: string;
  country_scope: string | null;
  rate_pct: number | null;
  rate_type: string;
  legal_basis: string;
  effective_date: string;
  expiration_date: string | null;
  source_url: string;
  source_tier: number;
  data_as_of: string;
}

export function getPulseTariffs(opts: { program?: string; country?: string; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.program) params.set('program', opts.program);
  if (opts.country) params.set('country', opts.country);
  params.set('limit', String(opts.limit ?? 50));
  params.set('offset', String(opts.offset ?? 0));
  return request<{ rows: TariffOverlayRow[]; total: number; limit: number; offset: number; programs: string[] }>(`/pulse/tariffs?${params}`);
}

export interface SanctionRow {
  id: number;
  name: string;
  addresses: string | null;
  source_url: string;
  list: 'SDN' | 'CSL';
  entity_type?: string | null;
  programs?: string;
  source_list?: string;
  license_requirement?: string | null;
}

export function getPulseSanctions(opts: { country?: string; list?: 'sdn' | 'csl'; limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.country) params.set('country', opts.country);
  if (opts.list) params.set('list', opts.list);
  params.set('limit', String(opts.limit ?? 50));
  params.set('offset', String(opts.offset ?? 0));
  return request<{ sdn: { rows: SanctionRow[]; total: number }; csl: { rows: SanctionRow[]; total: number }; limit: number; offset: number; note: string }>(
    `/pulse/sanctions?${params}`
  );
}

export interface ExportChartRow {
  country_code: string;
  country_name: string;
  reason_for_control: string;
  control_level: string;
  source_url: string;
}

export interface ExportChartCoverageRow {
  country_code: string;
  country_name: string;
  status: string;
  notes: string | null;
  source_url: string;
}

export function getPulseExportControlChart() {
  return request<{ rows: ExportChartRow[]; coverage: ExportChartCoverageRow[] }>('/pulse/export-control-chart');
}

export function getPulseCoferHistory() {
  return request<{ points: [string, number][]; eur?: [string, number][]; cny?: [string, number][] }>('/pulse/cofer');
}

export interface NatoDefenseCountry {
  points: [string, number][];
  source: string;
  sourceUrl: string;
  asOf: string;
}

export function getNatoDefenseSpending() {
  return request<{ countries: Record<string, NatoDefenseCountry> }>('/pulse/nato-defense');
}

export interface DataStatus {
  asOf: string;
  sources: { source: string; lastSuccess: string | null; lastError: string | null }[];
}
export function getDataStatus() {
  return request<DataStatus>('/pulse/data-status');
}

export interface DataStats {
  asOf: string;
  counts: Record<string, number | null>;
}
export function getDataStats() {
  return request<DataStats>('/pulse/stats');
}

export interface SanctionCounts {
  asOf: string;
  /** Listings across the four lists. A party on several lists is counted once per list. */
  total: number;
  totals?: { sdn: number; csl: number; un: number; uk: number };
  countries: { country: string; count: number; bySource?: { sdn: number; csl: number; un: number; uk: number } }[];
  /** How current each list is, so every count can carry its as-of date. */
  lists?: import('../types/pulse').SourceFreshness[];
}

export function getSanctionCounts() {
  return request<SanctionCounts>('/pulse/sanction-counts');
}

export type PowerUnit = 'usd' | 'usd_per_person' | 'pct' | 'count' | 'index' | 'distance' | 'per_1000' | 'points';
export interface PowerStanding {
  value: number;
  year: number;
  rank: number;
  of: number;
}
export interface PowerIndicator {
  id: string;
  label: string;
  unit: PowerUnit;
  dimension: string;
  definition: string;
  caveat: string;
  higherIs: string;
  sourceCode: string;
  source: { name: string; url: string };
  latestYear: number | null;
  /** Set when the upstream series has stopped publishing: it is not ranked. */
  endedYear?: number;
  /** Year of each ranked country's figure. */
  years?: Record<string, number>;
  standings: Record<string, PowerStanding | null>;
  series: Record<string, [number, number][]>;
  /** Every ranked country's newest value, ascending. */
  distribution: [string, number][];
}
export interface PowerResponse {
  asOf: string | null;
  loaded: boolean;
  countries: string[];
  dimensions: { id: string; label: string; blurb: string }[];
  indicators: PowerIndicator[];
}

export function getPower(countries: string[]) {
  return request<PowerResponse>(`/pulse/power?countries=${encodeURIComponent(countries.join(','))}`);
}

export interface OpinionSurvey {
  id: string;
  pollster: string;
  subject: 'US' | 'CN';
  year: number;
  title: string;
  release: string;
  fieldwork: string;
  url: string;
  publishedMedian: number;
  countriesInMedian: number;
  favorable: Record<string, number>;
  citation: string;
}
export interface AfroShare {
  pos: number;
  neg: number;
  n: number;
}
export interface AfroCovid {
  china: number;
  us: number;
  russia: number;
  europe: number;
  india: number;
  au: number;
  none: number;
  n: number;
}
export interface AfroUkraine {
  neutral: number;
  russia: number;
  ukraine: number;
  n: number;
}
export interface AfroCountry {
  cn: AfroShare;
  us: AfroShare;
  ru?: AfroShare;
  in?: AfroShare;
  fc?: AfroShare;
  eu?: AfroShare;
  covid?: AfroCovid;
  ukraine?: AfroUkraine;
  from: string;
  to: string;
}
export interface AfroOpinion {
  name: string;
  url: string;
  question: string;
  citation: string;
  medianPositive: { cn: number; us: number };
  countries: Record<string, AfroCountry>;
}
export interface OpinionResponse {
  question: string;
  disclaimer: string;
  surveys: OpinionSurvey[];
  africa: AfroOpinion;
}

export function getOpinion() {
  return request<OpinionResponse>('/pulse/opinion');
}

export interface TiesResponse {
  partners: string[];
  ties: Record<string, { lang: string[]; colony: string[] }>;
  source: { name: string; url: string; citation: string; caveat: string };
}

export function getTies() {
  return request<TiesResponse>('/pulse/ties');
}

export interface UnAlignment {
  asOf: string | null;
  years: number[];
  /** Position by country, one entry per year in `years`; null where the country did not vote that year. */
  positions: Record<string, (number | null)[]>;
}

export function getUnAlignment() {
  return request<UnAlignment>('/pulse/un-alignment');
}

export function syncPulse() {
  // request() already throws with the server's `error` message on a non-2xx
  // response (429 cooldown, 502 Federal Register failure) -- a resolved call
  // always means the sync actually ran.
  return request<{ ok: true; rows: number }>('/pulse/sync', { method: 'POST' });
}

export function getPulseMarkets(days?: number) {
  return request<PulseMarkets>(`/pulse/markets${days ? `?days=${days}` : ''}`);
}

export function getPulseNews(category?: string, limit = 30) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category) params.set('category', category);
  return request<PulseNewsResponse>(`/pulse/news?${params}`);
}

export interface PulseCoverage {
  federal_register: string | null;
  news: string | null;
  yahoo_finance: string | null;
  ecb_fx: string | null;
  bls: string | null;
  imf_cofer: string | null;
}

export function getPulseCoverage() {
  return request<PulseCoverage>('/pulse/coverage');
}

export interface PulseSnapshot<TData = unknown, TParams = unknown> {
  id: string;
  chart_type: 'tempo' | 'markets' | 'cofer' | 'power';
  title: string;
  params: TParams;
  data: TData;
  source_note: string;
  created_at: string;
}

// The server rebuilds the snapshot's data itself; only the chart type and its range are taken from the request.
export function createSnapshot(args: { chart_type: 'tempo' | 'markets' | 'cofer' | 'power'; title?: string; params: unknown; data?: unknown; source_note?: string }) {
  return request<{ id: string; created_at: string }>('/pulse/snapshots', { method: 'POST', body: JSON.stringify(args) });
}

export function getSnapshot(id: string) {
  return request<PulseSnapshot>(`/pulse/snapshots/${id}`);
}

export function getPulseConnections(code: string, opts: { name?: string; days?: number; topic?: string; countries?: string[] } = {}) {
  const params = opts.countries?.length ? new URLSearchParams({ countries: opts.countries.join(',') }) : new URLSearchParams({ country: code });
  if (opts.name) params.set('name', opts.name);
  if (opts.days) params.set('days', String(opts.days));
  if (opts.topic) params.set('topic', opts.topic);
  return request<ConnectionsResponse>(`/pulse/connections?${params.toString()}`);
}

export function getPulseRelated(kind: 'action' | 'news', id: string, names: Record<string, string> = {}) {
  const params = new URLSearchParams({ kind, id });
  const pairs = Object.entries(names).map(([c, n]) => `${c}:${n}`);
  if (pairs.length) params.set('names', pairs.join('|'));
  return request<RelatedResponse>(`/pulse/related?${params.toString()}`);
}

export function getPulseConvergence(opts: { days?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.days) params.set('days', String(opts.days));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return request<ConvergenceResponse>(`/pulse/convergence${qs ? `?${qs}` : ''}`);
}

export interface TicHolder {
  id: string;
  code: string;
  label: string;
  asOf: string;
  billions: number;
  yearAgoBillions: number | null;
  history: [string, number][];
}
export interface TicHolders {
  total: TicHolder | null;
  official: TicHolder | null;
  countries: TicHolder[];
  source: string;
  sourceUrl: string;
}

export function getTicHolders() {
  return request<TicHolders>('/pulse/tic');
}

export interface RecentListings {
  days: number;
  total: number;
  items: { id: string; date: string; title: string; url: string | null; source: string | null; countries: string[] }[];
  lists?: import('../types/pulse').SourceFreshness[];
}

export function getRecentListings(days = 30) {
  return request<RecentListings>(`/pulse/recent-listings?days=${days}`);
}

// --- Soft Power scoreboard: published trend readings (see src/lib/power/trends.ts) ---
export type TrendSubject = 'US' | 'CN' | 'RU' | 'DE' | 'CA' | 'GB';
export interface TrendLine {
  subject: TrendSubject;
  label: string;
  points: [number, number][];
}
export interface TrendReading {
  id: string;
  title: string;
  measure: string;
  unit: 'percent' | 'net' | 'score';
  population: 'public' | 'experts';
  publisher: string;
  url: string;
  release: string;
  coverage: string;
  caveat: string;
  periodNote?: string;
  /** Year -> how to print it, for a period plotted at its middle year (2008 -> "2007 to 2009"). */
  periodLabels?: Record<string, string>;
  lines: TrendLine[];
  headline: string;
}
export interface TrendEvent {
  date: string;
  label: string;
  sourceName: string;
  url: string;
}
export interface PewSeriesSource {
  name: string;
  url: string;
  release: string;
}
export interface TrendsResponse {
  readings: TrendReading[];
  events: TrendEvent[];
  pew: {
    disclaimer: string;
    usFavorable: Record<string, [number, number][]>;
    cnFavorable: Record<string, [number, number][]>;
    us: PewSeriesSource;
    cn: PewSeriesSource;
    drivers: {
      source: { name: string; url: string; citation: string; question: string };
      /** Country -> [2024, 2025, 2026]. */
      countries: Record<string, { favorable: [number, number, number]; confidence: [number, number, number] }>;
    };
  };
}

export function getTrends() {
  return request<TrendsResponse>('/pulse/trends');
}

// --- Everyday data and the free tariff lookup (src/routes/pulse/everyday.ts) ---
export interface EverydaySeries {
  id: string;
  label: string;
  group: string | null;
  unit: string | null;
  source: string | null;
  sourceUrl: string | null;
  latest: [string, number] | null;
  yoyPct: number | null;
  points: [string, number][];
}
export interface EverydayResponse {
  prices: EverydaySeries[];
  jobs: EverydaySeries[];
  customs: { gross: EverydaySeries; net: EverydaySeries };
  tariffDates: { program: string; since: string; rate: number | null; legal_basis: string; source_url: string }[];
}
export function getEveryday() {
  return request<EverydayResponse>('/pulse/everyday');
}
// Census trade by partner and foreign-born population (key-gated on the server: status 'needs_key' or 'not_loaded' means no data yet).
export type CensusStatus = 'ok' | 'needs_key' | 'not_loaded';
/** [month 'YYYY-MM', imports, calculated duties, exports], U.S. dollars. */
export type CensusPoint = [string, number | null, number | null, number | null];
export interface CensusTrailing {
  asOf: string;
  months: number;
  imports: number;
  duties: number;
  exports: number;
  balance: number;
  shareOfUsImportsPct: number | null;
  effectiveRatePct: number | null;
}
export interface CensusTariffRate {
  status: CensusStatus;
  updatedAt: string | null;
  source: string;
  sourceUrl: string;
  asOf: string | null;
  note?: string;
  total: CensusPoint[];
  trailing12?: CensusTrailing | null;
  partners: { code: string; iso2: string | null; name: string; points: CensusPoint[] }[];
  tariffDates: EverydayResponse['tariffDates'];
}
export function getCensusTariffRate() {
  return request<CensusTariffRate>('/pulse/census/tariff-rate');
}
export interface CensusCompare {
  status: CensusStatus;
  source: string;
  sourceUrl: string;
  asOf: string | null;
  updatedAt: string | null;
  countries: Record<string, CensusTrailing | null>;
}
export function getCensusCompare(codes: string[]) {
  return request<CensusCompare>(`/pulse/census/compare?countries=${encodeURIComponent(codes.join(','))}`);
}
export interface CensusCountry {
  status: CensusStatus;
  source: string;
  sourceUrl: string;
  asOf: string | null;
  name: string | null;
  points: CensusPoint[];
  trailing12: CensusTrailing | null;
}
export function getCensusCountry(code: string) {
  return request<CensusCountry>(`/pulse/census/country/${encodeURIComponent(code)}`);
}
export interface ForeignBorn {
  status: CensusStatus;
  year: number | null;
  national: number | null;
  states: { state: string; estimate: number }[];
  source: string;
  sourceUrl: string;
  note: string;
}
export function getForeignBorn(code: string) {
  return request<ForeignBorn>(`/pulse/census/foreign-born/${encodeURIComponent(code)}`);
}
export interface TravelAdvisory {
  country: string;
  level: number;
  title: string;
  url: string;
  updated: string | null;
}
export function getAdvisories() {
  return request<{ asOf: string | null; source: string; items: TravelAdvisory[] }>('/pulse/advisories');
}
export interface RemittanceInfo {
  status: 'ok' | 'not_tracked' | 'unavailable';
  cost: { pct: number; year: number } | null;
  usOutbound: { pct: number; year: number } | null;
  scope: string;
  source: string;
  sourceUrl: string;
  checkedOn: string;
}
export function getRemittance(iso: string) {
  return request<RemittanceInfo>(`/pulse/remittance/${encodeURIComponent(iso)}`);
}
export interface CsmsMessage {
  id: string;
  title: string;
  published: string;
  url: string;
  programs: string[];
}
export interface CsmsResponse {
  asOf: string | null;
  latest: string | null;
  source: string;
  sourceUrl: string;
  feedUrl: string;
  programs: string[];
  note: string;
  items: CsmsMessage[];
}
export function getCsms() {
  return request<CsmsResponse>('/pulse/csms');
}
export interface ChangeParty {
  uid: string;
  name: string | null;
  detail?: string | null;
  url?: string | null;
}
export interface ListChangeDay {
  added: ChangeParty[];
  removed: ChangeParty[];
  addedCount: number;
  removedCount: number;
  updatedCount: number;
}
export interface ListChangeSummary {
  date: string;
  lists: { source: string; label: string; addedCount: number; removedCount: number; updatedCount: number }[];
  addedTotal: number;
  removedTotal: number;
}
export function getListChanges() {
  return request<{ generatedAt: string | null; source: string; lists: Record<string, { label: string; sourceUrl: string }>; days: ListChangeSummary[] }>('/pulse/list-changes');
}
export function getListChangeDay(date: string) {
  return request<{ date: string; generatedAt: string | null; lists: Record<string, { label: string; sourceUrl: string }>; day: Record<string, ListChangeDay> }>(`/pulse/list-changes/${encodeURIComponent(date)}`);
}
export function getFxHistory(code: string) {
  return request<{ code: string; source: string; unit: string; points: [string, number][] }>(`/pulse/fx-history?code=${encodeURIComponent(code)}`);
}
export function searchHtsCodes(q: string) {
  return request<{ results: { htsno: string; description: string; general_rate: string | null; chapter: string | null }[] }>(`/pulse/hts-search?q=${encodeURIComponent(q)}`);
}
export interface DutyLookup {
  hts: string;
  description: string;
  country: string;
  generalRate: string | null;
  revision: string | null;
  totalPct: number | null;
  lines: import('../types/case').DutyStackLine[];
  adcvd?: AdcvdResult;
  note: string;
}
// Antidumping and countervailing duty orders that may apply (status 'not_loaded' until an official export has been loaded; see src/lib/adcvd.ts).
export interface AdcvdMatch {
  case_number: string;
  order_type: 'AD' | 'CVD';
  country: string;
  product: string;
  order_date: string | null;
  rate_min: number | null;
  rate_max: number | null;
  source_url: string;
  basis: 'hts' | 'keyword';
}
export interface AdcvdResult {
  status: 'ok' | 'not_loaded';
  asOf: string | null;
  source: string | null;
  matches: AdcvdMatch[];
  searchUrl: string;
  note: string;
}
export function getAdcvd(hts: string, country: string) {
  return request<AdcvdResult>(`/pulse/adcvd?hts=${encodeURIComponent(hts)}&country=${encodeURIComponent(country)}`);
}
// Freight and supply-chain indicators: NY Fed GSCPI (monthly) and IMF PortWatch chokepoint transits (weekly averages).
export interface FreightResponse {
  gscpi: { label: string; unit: string; source: string; sourceUrl: string; asOf: string | null; points: [string, number][] };
  chokepoints: { id: string; name: string; points: [string, number][]; asOf: string | null }[];
  chokepointSource: string;
  chokepointSourceUrl: string;
  note: string;
}
export function getFreight() {
  return request<FreightResponse>('/pulse/freight');
}
export function lookupDuty(hts: string, country: string) {
  return request<DutyLookup | { choices: { htsno: string; description: string; general_rate: string | null }[] }>(`/pulse/duty?hts=${encodeURIComponent(hts)}&country=${encodeURIComponent(country)}`);
}

// --- The "Today" dashboard (src/lib/pulse/briefing.ts) ---
export interface TodayCard<T> {
  data: T;
  asOf: string | null;
  source: string;
  sourceUrl: string;
}
export interface TodayData {
  asOf: string;
  sentences: { id: string; text: string; card: string }[];
  trade: TodayCard<{ last7: number; last30: number; trendPct: number | null; openForComment: number | null; leadingTag: string | null; recent: { title: string; url: string; date: string; tag: string; countries: string[] }[] }> | null;
  prices: TodayCard<{ id: string; label: string; latest: string; changePct: number | null; since: string | null; points: [string, number][] }[]> | null;
  money: TodayCard<{
    currencies: { quote: string; name: string; rate: number; change30dPct: number | null }[];
    tenYearPct: number | null;
    oil: { value: number; changePct: number | null; asOf: string } | null;
    dollarReservesPct: number | null;
  }> | null;
  sanctions: TodayCard<{ date: string; added: number; removed: number } | null> | null;
  politics: TodayCard<{ title: string; url: string; source: string; date: string; category: string; countries: string[] }[]> | null;
  travel: TodayCard<{ level4: { country: string; title: string; url: string; updated: string }[]; level4Count: number; level3Count: number }> | null;
  events: TodayCard<{ kind: 'earthquake' | 'storm' | 'volcano' | 'wildfire' | 'flood'; title: string; date: string; url: string; magnitude?: number }[]> | null;
  forCountries: {
    notices: { title: string; url: string; date: string; countries: string[] }[];
    news: { title: string; url: string; source: string; date: string; countries: string[] }[];
    advisories: { country: string; level: number; url: string; updated: string }[];
  };
}
export function getToday() {
  return request<TodayData>('/pulse/today');
}

// --- The Dashboard sections (src/lib/pulse/dashboardEconomy.ts) ---
export type DashPt = [string, number];
export interface DashSeriesRow {
  id: string;
  label: string;
  latest: string;
  changePct: number | null;
  since: string | null;
  points: DashPt[];
}
export interface DashKeyNumber {
  id: string;
  label: string;
  value: string;
  change: string | null;
  direction: 'up' | 'down' | 'flat' | null;
  asOf: string | null;
  points: DashPt[];
  href: string;
  section: string;
}
export interface EconomyData {
  asOf: string;
  summary: string[];
  keyNumbers: DashKeyNumber[];
  rates: { curve: { label: string; pct: number }[]; asOf: string; inverted: boolean } | null;
  inflation: { cpi: DashSeriesRow | null; prices: DashSeriesRow[] } | null;
  jobs: {
    unemployment: { pct: number; changePts: number | null; asOf: string; points: DashPt[] } | null;
    payrolls: { thousands: number; monthlyChangeThousands: number | null; asOf: string; points: DashPt[] } | null;
    industries: DashSeriesRow[];
  } | null;
  commodities: { id: string; label: string; unit: string; value: number; changePct: number | null; asOf: string; points: DashPt[] }[];
  currencies: { quote: string; name: string; rate: number; change30dPct: number | null; spark: number[] }[];
  dollarRole: { reservesPct: number | null; reservesAsOf: string | null; holdersTotalBillions: number | null; holdersYearAgoBillions: number | null; holdersAsOf: string | null; topHolders: { label: string; billions: number; yearAgoBillions: number | null }[] } | null;
  tradePrices: { id: string; label: string; value: number; changePct: number | null; asOf: string; points: DashPt[] }[];
}
export function getDashboardEconomy() {
  return request<EconomyData>('/pulse/dashboard/economy');
}
