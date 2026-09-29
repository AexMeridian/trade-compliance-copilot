import { COUNTRY_LABELS } from './pulseCountries';

// Display names for the Section 301 forced-labor list (60 economies --
// migrations/0008_seed_tariff_overlays_301.sql), merged with the smaller
// text-extraction set in pulseCountries.ts. Kept separate from that file on
// purpose: its own comment documents it as mirroring the backend's
// text-extraction COUNTRY_LABELS specifically, and most of these 38 codes
// aren't part of that system at all -- they only ever come from this static
// tariff-program list, never from parsing a document's title. Standard ISO
// country names, real and unambiguous, not derived from any feed.
const TARIFF_ONLY_LABELS: Record<string, string> = {
  LI: 'Liechtenstein',
  AR: 'Argentina',
  BD: 'Bangladesh',
  KH: 'Cambodia',
  EC: 'Ecuador',
  SV: 'El Salvador',
  GT: 'Guatemala',
  HN: 'Honduras',
  PK: 'Pakistan',
  LK: 'Sri Lanka',
  JO: 'Jordan',
  TT: 'Trinidad and Tobago',
  DZ: 'Algeria',
  AO: 'Angola',
  AU: 'Australia',
  BS: 'Bahamas',
  BH: 'Bahrain',
  CL: 'Chile',
  CO: 'Colombia',
  CR: 'Costa Rica',
  DO: 'Dominican Republic',
  EG: 'Egypt',
  GY: 'Guyana',
  HK: 'Hong Kong',
  IQ: 'Iraq',
  KZ: 'Kazakhstan',
  KW: 'Kuwait',
  LY: 'Libya',
  MA: 'Morocco',
  NZ: 'New Zealand',
  NI: 'Nicaragua',
  NG: 'Nigeria',
  NO: 'Norway',
  PE: 'Peru',
  PH: 'Philippines',
  QA: 'Qatar',
  SG: 'Singapore',
  ZA: 'South Africa',
  UY: 'Uruguay',
};

export const TARIFF_COUNTRY_LABELS: Record<string, string> = { ...COUNTRY_LABELS, ...TARIFF_ONLY_LABELS };
