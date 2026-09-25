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
  countries: string | null; // JSON array of country codes, e.g. "[\"CN\",\"MX\"]" -- see lib/pulse/country.ts
}

export interface TempoPoint {
  month: string; // YYYY-MM
  count: number;
}
