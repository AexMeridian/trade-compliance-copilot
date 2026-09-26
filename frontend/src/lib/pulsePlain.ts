// Plain-English wording for things the source data only gives in official
// form. Everything here is a fixed template filled from fields the Federal
// Register already supplies (document type, agency, our topic tag, dates,
// countries) -- no model writes it and it never claims anything about a
// document's contents beyond those fields.

import type { PulseAction } from '../types/pulse';
import { COUNTRY_LABELS, parseCountries } from './pulseCountries';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-09-23" -> "Sep 23" (with the year only when it isn't this year).
// Parsed by hand so a date never shifts a day with the visitor's time zone.
export function friendlyDate(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ?? '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return iso ?? '';
  const day = Number(m[3]);
  return Number(m[1]) === new Date().getFullYear() ? `${month} ${day}` : `${month} ${day}, ${m[1]}`;
}

const DAY_MS = 86_400_000;
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);

// "3 minutes ago", "2 hours ago", "yesterday" -- for the "updated" line.
export function agoText(iso: string | null | undefined): string {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const DOC_PHRASE: Record<string, string> = {
  Rule: 'A final rule',
  'Proposed Rule': 'A proposed rule (not final yet)',
  Notice: 'An official announcement',
  'Presidential Document': 'A presidential order',
};

const TOPIC_PHRASE: Record<string, string> = {
  Tariff: 'about tariffs',
  Sanctions: 'about sanctions',
  'Export Control': 'about export controls',
  'Trade Agreement': 'about a trade agreement',
  Other: 'on a trade-related matter',
};

// First one or two comma-separated names only: multi-agency documents can list
// dozens of agencies, and the first is the lead.
function agencyPhrase(agency: string): string {
  const head = agency.split(', ').slice(0, 2).join(', ');
  if (/International Trade Administration/.test(head)) return "the Commerce Department's trade office";
  if (/Industry and Security/.test(head)) return "the Commerce Department's export-control office";
  if (/Foreign Assets Control/.test(head)) return "the Treasury Department's sanctions office";
  if (/Customs and Border/.test(head)) return 'U.S. Customs and Border Protection';
  if (/International Trade Commission/.test(head)) return 'the U.S. International Trade Commission';
  if (/^Trade Representative/.test(head)) return 'the U.S. Trade Representative';
  if (/^Executive Office of the President/.test(head)) return 'the White House';
  return `the ${agency.split(', ')[0]}`.replace(/^the the /, 'the ');
}

export function plainSummary(a: PulseAction): string {
  const doc = DOC_PHRASE[a.doc_type] ?? 'An official document';
  const topic = TOPIC_PHRASE[a.tag] ?? TOPIC_PHRASE.Other;
  const parts = [`${doc} ${topic} from ${agencyPhrase(a.agency)}.`];

  const today = todayIso();
  if (a.comments_close_on && a.comments_close_on >= today) {
    const left = daysBetween(today, a.comments_close_on);
    parts.push(
      `You can comment until ${friendlyDate(a.comments_close_on)}${left <= 30 ? ` (${left === 0 ? 'today' : `${left} day${left === 1 ? '' : 's'} left`})` : ''}.`,
    );
  } else if (a.effective_on) {
    parts.push(a.effective_on <= today ? `Took effect ${friendlyDate(a.effective_on)}.` : `Takes effect ${friendlyDate(a.effective_on)}.`);
  }

  const countries = parseCountries(a.countries).map((c) => COUNTRY_LABELS[c] ?? c);
  if (countries.length > 0) parts.push(`Involves ${countries.slice(0, 3).join(', ')}${countries.length > 3 ? ' and others' : ''}.`);
  return parts.join(' ');
}
