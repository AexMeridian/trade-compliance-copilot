// Deterministic cross-domain linking. Two events are "related" only when a
// stated rule says so: they name the same country, share at least one topic,
// and fall within a time window. Every link carries the reason it exists, so a
// reader can judge it -- nothing here claims causation, and nothing is guessed.
import type { Topic } from './topic.js';

export type EventKind = 'action' | 'news' | 'gta' | 'wro';

export interface ConnEvent {
  kind: EventKind;
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  url: string | null;
  source: string | null;
  countries: string[];
  topics: Topic[];
}

export interface RelatedLink {
  event: ConnEvent;
  score: number;
  reason: string;
  sharedCountries: string[];
  sharedTopics: Topic[];
  daysApart: number;
}

const DAY_MS = 86_400_000;

/** Items naming more countries than this are roundups and don't link on country. */
export const MAX_FOCUS_COUNTRIES = 3;
const ROUTINE_KINDS = new Set<EventKind>(['action', 'wro']);
const GENERIC_TOPICS = new Set<Topic>(['Tariffs', 'Supply chain & shipping']);

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY_MS);
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Relates `candidate` to `subject`, or returns null. Same country AND a shared
 * topic AND within `windowDays` -- all three, never fewer.
 */
export function relate(subject: ConnEvent, candidate: ConnEvent, windowDays: number, nameOf: (code: string) => string = (c) => c): RelatedLink | null {
  if (candidate.kind === subject.kind && candidate.id === subject.id) return null;
  const sharedCountries = subject.countries.filter((c) => candidate.countries.includes(c));
  if (sharedCountries.length === 0) return null;
  const sharedTopics = subject.topics.filter((t) => candidate.topics.includes(t));
  if (sharedTopics.length === 0) return null;
  const daysApart = Math.abs(daysBetween(subject.date, candidate.date));
  if (daysApart > windowDays) return null;

  // An item naming many countries is a roundup, not "about" any one of them.
  if (subject.countries.length > MAX_FOCUS_COUNTRIES || candidate.countries.length > MAX_FOCUS_COUNTRIES) return null;
  // Two routine notices of the same kind sharing only a generic topic are just
  // the same program running (e.g. two antidumping cases on one country) -- not
  // a connection worth showing.
  if (subject.kind === candidate.kind && ROUTINE_KINDS.has(subject.kind) && sharedTopics.every((t) => GENERIC_TOPICS.has(t))) return null;

  // Cross-domain links (news <-> action <-> barrier) are the point, so they
  // outrank same-kind ones; more shared topics and countries rank higher;
  // closer in time breaks ties.
  const crossKind = subject.kind !== candidate.kind ? 5 : 0;
  const score = crossKind + sharedTopics.length * 10 + sharedCountries.length * 3 + (windowDays - daysApart) / windowDays;
  const when = daysApart === 0 ? 'the same day' : `${daysApart} day${daysApart === 1 ? '' : 's'} apart`;
  const reason = `Both name ${listJoin(sharedCountries.map(nameOf))}, both about ${listJoin(sharedTopics.map((t) => t.toLowerCase()))}, ${when}.`;
  return { event: candidate, score, reason, sharedCountries, sharedTopics, daysApart };
}

export function findRelated(subject: ConnEvent, candidates: ConnEvent[], opts: { windowDays: number; limit: number; nameOf?: (code: string) => string }): RelatedLink[] {
  const links: RelatedLink[] = [];
  for (const c of candidates) {
    const link = relate(subject, c, opts.windowDays, opts.nameOf);
    if (link) links.push(link);
  }
  return links.sort((a, b) => b.score - a.score).slice(0, opts.limit);
}

export interface SeriesPoint {
  obs_date: string;
  value: number;
}

export interface MarketReaction {
  beforeDate: string;
  beforeValue: number;
  afterDate: string;
  afterValue: number;
  changePct: number;
}

/**
 * How a series moved across an event date: the last observation on or up to
 * `maxGapDays` before the date, versus the first observation on or after
 * date + `horizonDays` (within `maxGapDays` of it). Returns null when the
 * series doesn't cover both sides -- an honest "not enough data", never an
 * extrapolation. `series` must be sorted ascending by date.
 */
export function marketReaction(series: SeriesPoint[], eventDate: string, opts: { horizonDays?: number; maxGapDays?: number } = {}): MarketReaction | null {
  const horizonDays = opts.horizonDays ?? 5;
  const maxGapDays = opts.maxGapDays ?? 4;
  const day = eventDate.slice(0, 10);
  let before: SeriesPoint | null = null;
  for (const p of series) {
    if (p.obs_date <= day) before = p;
    else break;
  }
  if (!before || daysBetween(before.obs_date, day) > maxGapDays) return null;
  const target = new Date(Date.parse(day) + horizonDays * DAY_MS).toISOString().slice(0, 10);
  const after = series.find((p) => p.obs_date >= target);
  if (!after || daysBetween(target, after.obs_date) > maxGapDays) return null;
  if (before.value === 0) return null;
  const changePct = ((after.value - before.value) / before.value) * 100;
  return { beforeDate: before.obs_date, beforeValue: before.value, afterDate: after.obs_date, afterValue: after.value, changePct: Math.round(changePct * 100) / 100 };
}
