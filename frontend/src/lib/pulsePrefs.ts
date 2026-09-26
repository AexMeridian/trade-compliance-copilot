// "What do I follow?" -- a visitor's own view of Pulse. Stored only in this
// browser (localStorage), not on the server: there are no accounts, nothing
// about a visitor is sent anywhere, and clearing site data resets it.
//
// Semantics are the same for every list: nothing selected means everything.
// Someone who has never customised anything therefore sees exactly the
// default feed, and picking one topic narrows to that topic.

import type { NewsItem, PulseAction } from '../types/pulse';
import { parseCountries } from './pulseCountries';

export const POLICY_TOPICS = ['Tariff', 'Sanctions', 'Export Control', 'Trade Agreement', 'Other'] as const;
export const NEWS_TOPICS = ['Trade & Supply Chain', 'Markets & Currency', 'Elections & Politics', 'Official'] as const;
export const MARKET_TOPICS = ['U.S. stocks', 'World stocks', 'Trade bellwethers', 'Commodities', 'Rates & dollar', 'Currencies'] as const;

export interface PulsePrefs {
  tags: string[]; // U.S. policy topics
  newsCats: string[]; // news topics
  countries: string[]; // ISO-style codes from lib/pulseCountries.ts
  markets: string[]; // market groups, plus 'Currencies'
  showNews: boolean; // headlines on the Overview
  showMarkets: boolean; // market strip on the Overview
}

export const DEFAULT_PREFS: PulsePrefs = { tags: [], newsCats: [], countries: [], markets: [], showNews: true, showMarkets: true };

const STORAGE_KEY = 'pulse:prefs:v1';

const keepKnown = (values: unknown, known: readonly string[]): string[] =>
  Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string' && known.includes(v)) : [];

// Storage can be empty, blocked, or hold something from an older version, so
// every read is guarded and every field is checked against what exists today.
export function loadPrefs(): PulsePrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<PulsePrefs>;
    return {
      tags: keepKnown(p.tags, POLICY_TOPICS),
      newsCats: keepKnown(p.newsCats, NEWS_TOPICS),
      countries: Array.isArray(p.countries) ? p.countries.filter((c): c is string => typeof c === 'string' && /^[A-Z]{2}$/.test(c)) : [],
      markets: keepKnown(p.markets, MARKET_TOPICS),
      showNews: p.showNews !== false,
      showMarkets: p.showMarkets !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: PulsePrefs): void {
  try {
    if (isDefaultPrefs(p)) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode or blocked storage: the choice just lasts until the tab closes */
  }
}

export function isDefaultPrefs(p: PulsePrefs): boolean {
  return !p.tags.length && !p.newsCats.length && !p.countries.length && !p.markets.length && p.showNews && p.showMarkets;
}

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  prefs: PulsePrefs;
}

export const PRESETS: Preset[] = [
  { id: 'default', label: 'Everything', blurb: 'The full default feed.', prefs: DEFAULT_PREFS },
  {
    id: 'trader',
    label: 'Importer or exporter',
    blurb: 'Tariffs, trade deals, shipping news and the currencies and commodities that set your costs.',
    prefs: {
      ...DEFAULT_PREFS,
      tags: ['Tariff', 'Trade Agreement'],
      newsCats: ['Trade & Supply Chain'],
      markets: ['Commodities', 'Rates & dollar', 'Currencies'],
    },
  },
  {
    id: 'investor',
    label: 'Investor',
    blurb: 'Markets first: stocks, commodities, rates and currencies, plus tariff news that moves them.',
    prefs: {
      ...DEFAULT_PREFS,
      tags: ['Tariff'],
      newsCats: ['Markets & Currency', 'Trade & Supply Chain'],
      markets: ['U.S. stocks', 'World stocks', 'Trade bellwethers', 'Commodities', 'Currencies'],
    },
  },
  {
    id: 'compliance',
    label: 'Compliance officer',
    blurb: 'Sanctions and export controls, official announcements, no market data.',
    prefs: { ...DEFAULT_PREFS, tags: ['Sanctions', 'Export Control'], newsCats: ['Official', 'Trade & Supply Chain'], showMarkets: false },
  },
  {
    id: 'policy',
    label: 'Policy watcher',
    blurb: 'Rule-making, trade agreements and elections, without the market numbers.',
    prefs: {
      ...DEFAULT_PREFS,
      tags: ['Trade Agreement', 'Tariff', 'Export Control'],
      newsCats: ['Elections & Politics', 'Trade & Supply Chain', 'Official'],
      showMarkets: false,
    },
  },
];

export function samePrefs(a: PulsePrefs, b: PulsePrefs): boolean {
  const eq = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  return (
    eq(a.tags, b.tags) &&
    eq(a.newsCats, b.newsCats) &&
    eq(a.countries, b.countries) &&
    eq(a.markets, b.markets) &&
    a.showNews === b.showNews &&
    a.showMarkets === b.showMarkets
  );
}

const overlaps = (wanted: string[], found: string[]) => wanted.length === 0 || found.some((c) => wanted.includes(c));

export function actionMatches(a: PulseAction, p: PulsePrefs): boolean {
  if (p.tags.length && !p.tags.includes(a.tag)) return false;
  return overlaps(p.countries, parseCountries(a.countries));
}

export function newsMatches(n: NewsItem, p: PulsePrefs): boolean {
  if (p.newsCats.length && !p.newsCats.includes(n.category)) return false;
  return overlaps(p.countries, parseCountries(n.countries));
}

export const groupVisible = (p: PulsePrefs, group: string): boolean => p.markets.length === 0 || p.markets.includes(group);

// One readable line for "you are seeing a filtered feed".
export function describePrefs(p: PulsePrefs, countryLabel: (code: string) => string): string {
  const parts = [...p.tags, ...p.newsCats, ...p.countries.map(countryLabel), ...p.markets];
  return parts.length ? parts.join(', ') : 'everything';
}

// ---- Shareable feed links: the same choices, encoded in the address so a
// colleague sees the same view. Nothing here is stored server-side.
const csv = (v: string[]) => v.join(',');
const fromCsv = (raw: string | null, known?: readonly string[]) =>
  (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && (!known || known.includes(x)));

export function prefsToQuery(p: PulsePrefs): string {
  const q = new URLSearchParams();
  if (p.tags.length) q.set('topics', csv(p.tags));
  if (p.newsCats.length) q.set('news', csv(p.newsCats));
  if (p.countries.length) q.set('countries', csv(p.countries));
  if (p.markets.length) q.set('markets', csv(p.markets));
  const hide = [!p.showNews && 'news', !p.showMarkets && 'markets'].filter(Boolean).join(',');
  if (hide) q.set('hide', hide);
  return q.toString();
}

// Returns null when the address carries no feed choices at all.
export function prefsFromQuery(q: URLSearchParams): PulsePrefs | null {
  if (!['topics', 'news', 'countries', 'markets', 'hide'].some((k) => q.has(k))) return null;
  const hide = fromCsv(q.get('hide'));
  const prefs: PulsePrefs = {
    tags: fromCsv(q.get('topics'), POLICY_TOPICS),
    newsCats: fromCsv(q.get('news'), NEWS_TOPICS),
    countries: fromCsv(q.get('countries')).filter((c) => /^[A-Z]{2}$/.test(c)),
    markets: fromCsv(q.get('markets'), MARKET_TOPICS),
    showNews: !hide.includes('news'),
    showMarkets: !hide.includes('markets'),
  };
  return isDefaultPrefs(prefs) ? null : prefs;
}

export const FEED_QUERY_KEYS = ['topics', 'news', 'countries', 'markets', 'hide'];
