import type { CaseFile, Direction, OriginComponent, PartyRole, Verdict } from '../types/case';
import type { PulseHome, ActiveMeasure, PulseAction, PulseCountryDetail, PulseMarkets, PulseNewsResponse, PulseSummary, TempoPoint } from '../types/pulse';

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

export function createCase(direction: Direction) {
  return request<{ id: string; case_file: CaseFile }>('/cases', {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
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
    body: JSON.stringify({ product_description: productDescription }),
  });
}

export function submitOrigin(id: string, components: OriginComponent[], finalAssemblyCountry: string) {
  return request<{ origin: CaseFile['origin'] }>(`/cases/${id}/origin`, {
    method: 'POST',
    body: JSON.stringify({ components, final_assembly_country: finalAssemblyCountry }),
  });
}

export function submitScreening(id: string, parties: { role: PartyRole; name: string }[]) {
  return request<{ screening: CaseFile['screening'] }>(`/cases/${id}/screening`, {
    method: 'POST',
    body: JSON.stringify({ parties }),
  });
}

export function submitDetermination(id: string, destinationCountry?: string) {
  return request<{ determination: CaseFile['determination'] }>(`/cases/${id}/determination`, {
    method: 'POST',
    body: JSON.stringify({ destination_country: destinationCountry }),
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

export function getPulseSummary() {
  return request<PulseSummary>('/pulse/summary');
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
  return request<{ points: [string, number][] }>('/pulse/cofer');
}

export function getActiveMeasures() {
  return request<{ overlays: ActiveMeasure[] }>('/pulse/active-measures');
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
