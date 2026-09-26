import type { CaseFile, Direction, OriginComponent, PartyRole, Verdict } from '../types/case';
import type { PulseHome, ActiveMeasure, PulseAction, PulseMarkets, PulseNewsResponse, PulseSummary, TempoPoint } from '../types/pulse';

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

export function getPulseTempo() {
  return request<{ months: TempoPoint[] }>('/pulse/tempo');
}

export function getPulseSummary() {
  return request<PulseSummary>('/pulse/summary');
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

export function getPulseMarkets() {
  return request<PulseMarkets>('/pulse/markets');
}

export function getPulseNews(category?: string, limit = 30) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category) params.set('category', category);
  return request<PulseNewsResponse>(`/pulse/news?${params}`);
}
