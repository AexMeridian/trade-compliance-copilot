import type { PulseTag } from './types.js';
import { AGENCY_SLUGS } from './federalRegister.js';

// Deterministic keyword/agency rules -- no LLM in this pipeline, matching the
// house rule that data ingestion stays non-LLM like every other refresh job.
// Order matters: an agency-confirmed match against a narrow regulatory
// domain (Sanctions/Export Control/Tariff-remedy agencies) is checked
// before the generic keyword buckets, so e.g. a BIS document that happens
// to also mention "tariff" keeps its real regulatory tag instead of falling
// into the broader bucket.
const OFAC_SLUG = 'foreign-assets-control-office';
const BIS_SLUG = 'industry-and-security-bureau';
const ITA_SLUG = 'international-trade-administration'; // antidumping/CVD determinations
const ITC_SLUG = 'international-trade-commission'; // AD/CVD injury determinations, Sec. 201/337

const SANCTIONS_RE = /\bsanctions?\b|specially designated national|\bSDN\b/i;
const EXPORT_CONTROL_RE = /export control|entity list|commerce control list|\bEAR\b|\bITAR\b|international traffic in arms/i;
const TARIFF_RE =
  /\btariff|\bsection 301\b|\bsection 232\b|\bsection 338\b|antidumping|countervailing duty|tariff-rate quota|safeguard|\bIEEPA\b|reciprocal tariff/i;
const TRADE_AGREEMENT_RE = /\bUSMCA\b|free trade agreement/i;

export function tagDocument(doc: { title: string; abstract: string | null; agencySlugs: string[] }): PulseTag {
  const text = `${doc.title} ${doc.abstract ?? ''}`;

  if (doc.agencySlugs.includes(OFAC_SLUG) || SANCTIONS_RE.test(text)) return 'Sanctions';
  // BIS's entire bureau function is export control, so agency membership
  // alone is a safe signal for it (same reasoning as OFAC above). State
  // Department is NOT narrowly export-control -- it's a huge multi-purpose
  // Cabinet department (diplomacy, visas, Privacy Act notices...), so it
  // only earns this tag when the text itself is actually about ITAR/defense
  // trade controls, never by agency membership alone (verified empirically:
  // a plain "Privacy Act of 1974; System of Records" notice from State was
  // getting tagged Export Control before this check was narrowed).
  if (doc.agencySlugs.includes(BIS_SLUG) || EXPORT_CONTROL_RE.test(text)) return 'Export Control';
  // ITA/ITC's core function is antidumping/countervailing-duty determinations
  // and other import-remedy actions -- these are additional import duties in
  // substance, so they belong in Tariff rather than a narrower bucket this
  // taxonomy doesn't have (e.g. an ITC Section 337 patent-exclusion notice
  // also lands here as the closest fit, not a fabricated 6th category).
  if (doc.agencySlugs.includes(ITA_SLUG) || doc.agencySlugs.includes(ITC_SLUG) || TARIFF_RE.test(text)) return 'Tariff';
  if (TRADE_AGREEMENT_RE.test(text)) return 'Trade Agreement';
  return 'Other';
}

// The Federal Register API returns agency *names*, not slugs, on a document.
// Since we only ever query the slugs in AGENCY_SLUGS, resolve a document's
// matching slugs by name substring against that fixed, already-verified set
// rather than a second API call.
const SLUG_NAME_HINTS: Record<(typeof AGENCY_SLUGS)[number], string> = {
  'trade-representative-office-of-united-states': 'trade representative',
  'industry-and-security-bureau': 'industry and security',
  'foreign-assets-control-office': 'foreign assets control',
  'u-s-customs-and-border-protection': 'customs and border',
  'international-trade-administration': 'international trade administration',
  'international-trade-commission': 'international trade commission',
  'state-department': 'state department',
};

export function resolveAgencySlugs(agencyNames: string[]): string[] {
  const lowerNames = agencyNames.map((n) => n.toLowerCase());
  return AGENCY_SLUGS.filter((slug) => lowerNames.some((n) => n.includes(SLUG_NAME_HINTS[slug])));
}
