// Federal Register API client for Trade Policy Pulse -- free, public, no
// auth. Agency slugs below were resolved against a live GET of
// /api/v1/agencies.json (473 agencies), not guessed -- a wrong slug silently
// returns zero results instead of erroring, so these are pinned as constants
// rather than re-derived at request time.
const BASE = 'https://www.federalregister.gov/api/v1';
const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';
const REQUEST_TIMEOUT_MS = 10_000;

// USTR/BIS/OFAC/CBP alone miss two entire regulatory domains this feed
// claims to track: antidumping/countervailing-duty determinations are
// issued by ITA and ITC, not BIS (verified live: the "antidumping" and
// "countervailing duty" keyword terms below returned only 40/43 documents
// over 24 months under the original 4-agency scope, vs. 2,409/2,257 once
// ITA+ITC are included -- those two terms were effectively decorative
// without this). ITAR (defense articles) is State Department/DDTC, a
// separate export-control regime from BIS/EAR entirely -- verified 77-113
// real ITAR documents/24mo were invisible without it.
export const AGENCY_SLUGS = [
  'trade-representative-office-of-united-states', // USTR
  'industry-and-security-bureau', // BIS
  'foreign-assets-control-office', // OFAC
  'u-s-customs-and-border-protection', // CBP
  'international-trade-administration', // ITA -- antidumping/CVD determinations
  'international-trade-commission', // ITC -- AD/CVD injury determinations, Sec. 201/337
  'state-department', // ITAR / defense trade controls (DDTC)
] as const;

export const KEYWORD_TERMS = [
  'tariff',
  'Section 301',
  'Section 232',
  'Section 338',
  'entity list',
  'sanctions',
  'export control',
  'antidumping',
  'countervailing duty',
  'USMCA',
  'IEEPA', // legal basis for the current reciprocal-tariff regime -- verified real, on-topic volume
  'reciprocal tariff',
  'ITAR',
] as const;

export interface FederalRegisterDocument {
  document_number: string;
  title: string;
  abstract: string | null;
  type: string;
  agencies: { name: string }[];
  publication_date: string;
  html_url: string;
  // Verified live via GET .../documents.json?fields[]=effective_on&... --
  // all three are real FR fields, just not part of the API's default field
  // set, so they have to be requested explicitly (see fetchDocumentsForTerm
  // below). effective_on/comments_close_on are usually null (most Notices
  // have neither); citation is populated on essentially every document.
  effective_on: string | null;
  comments_close_on: string | null;
  citation: string | null;
}

interface DocumentsResponse {
  count: number;
  total_pages: number;
  results: FederalRegisterDocument[];
}

// Sized against real, verified per-term volume across the full 7-agency
// scope over a 24-month backfill window: most terms fit in 1 page, but
// "tariff" needs 4 (3,201 docs) and antidumping/countervailing duty need 3
// each (~2,300-2,400 docs) -- 5 gives a page of headroom above the
// observed maximum rather than an arbitrary round number. Real subrequest
// cost for a full backfill across all 13 terms comes to roughly 20-25
// requests even with this scope, well inside the Workers Free plan's
// 50-subrequest-per-invocation budget; day-to-day incremental syncs only
// look back to the last checkpoint and never come close to this cap.
const MAX_PAGES_PER_TERM = 5;

export interface TermFetchResult {
  docs: FederalRegisterDocument[];
  truncated: boolean; // true if real results exist beyond MAX_PAGES_PER_TERM that were NOT fetched
}

export async function fetchDocumentsForTerm(term: string, sinceDate: string): Promise<TermFetchResult> {
  const docs: FederalRegisterDocument[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES_PER_TERM; page++) {
    const params = new URLSearchParams();
    params.set('conditions[term]', term);
    for (const slug of AGENCY_SLUGS) params.append('conditions[agencies][]', slug);
    params.set('conditions[publication_date][gte]', sinceDate);
    params.set('per_page', '1000');
    params.set('order', 'newest');
    params.set('page', String(page));
    // Requesting fields[] narrows the response to exactly this list (the
    // API's default set differs and omits effective_on/comments_close_on/
    // citation entirely) -- every field this codebase reads from a result
    // must be listed here.
    for (const field of ['document_number', 'title', 'abstract', 'type', 'agencies', 'publication_date', 'html_url', 'effective_on', 'comments_close_on', 'citation']) {
      params.append('fields[]', field);
    }

    const res = await fetch(`${BASE}/documents.json?${params.toString()}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Federal Register fetch failed for term "${term}": HTTP ${res.status}`);
    const body = (await res.json()) as DocumentsResponse;
    docs.push(...body.results);

    if (page >= body.total_pages) break;
    if (page === MAX_PAGES_PER_TERM && body.total_pages > MAX_PAGES_PER_TERM) truncated = true;
  }

  return { docs, truncated };
}
