// "What changed" on the sanctions and screening lists: parties added to or removed from each list, per day.
// The Worker cannot read git, so the daily list sync (scripts/sync-lists.ts) and the one-off backfill from git history
// (scripts/build-list-changes.ts) write data/lists/changes.json, which this module reads, merges and renders. Pure functions, no I/O.

export type ListSource = 'sdn' | 'csl' | 'un_sanctions' | 'uk_sanctions';

export const LIST_META: Record<ListSource, { label: string; sourceUrl: string }> = {
  sdn: { label: 'OFAC Specially Designated Nationals (SDN)', sourceUrl: 'https://sanctionslist.ofac.treas.gov/Home/SdnList' },
  csl: { label: 'Consolidated Screening List (Entity List, Denied Persons, Unverified and other non-SDN lists)', sourceUrl: 'https://www.trade.gov/consolidated-screening-list' },
  un_sanctions: { label: 'UN Security Council consolidated list', sourceUrl: 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list' },
  uk_sanctions: { label: 'UK Sanctions List', sourceUrl: 'https://sanctionslist.fcdo.gov.uk' },
};
export const LIST_SOURCES = Object.keys(LIST_META) as ListSource[];

export interface ChangeParty {
  uid: string;
  /** Null when the name was never recorded (an entry removed before names were kept). */
  name: string | null;
  /** The list or program inside the source (e.g. "Entity List", "RUSSIA-EO14024"), when known. */
  detail?: string | null;
  /** The entry's own page on the official list, when one exists. */
  url?: string | null;
}
export interface ListDay {
  added: ChangeParty[];
  removed: ChangeParty[];
  /** Totals; the arrays above are cut to MAX_NAMED each, so these can be larger. */
  addedCount: number;
  removedCount: number;
  /** Entries whose details changed but which stayed listed. */
  updatedCount: number;
}
export type ChangesFile = {
  generatedAt: string;
  days: Record<string, Partial<Record<ListSource, ListDay>>>;
};

export const MAX_NAMED = 400;
export const EMPTY_CHANGES: ChangesFile = { generatedAt: '', days: {} };

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isChangeDate = isDate;

/** Official page for one entry. OFAC's SDN search page takes the entry number; the others have no per-entry page keyed by our id. */
export function entryUrl(source: ListSource, uid: string, own?: string | null): string | null {
  if (source === 'sdn') return /^\d+$/.test(uid) ? `https://sanctionssearch.ofac.treas.gov/Details.aspx?id=${uid}` : null;
  if (own && /^https:\/\//.test(own)) return own;
  return LIST_META[source].sourceUrl;
}

/** Adds one run's changes to a day (a second run on the same day merges by key; an entry added then removed the same day drops out). */
export function mergeDay(existing: ListDay | undefined, incoming: ListDay): ListDay {
  if (!existing) return { ...incoming, added: incoming.added.slice(0, MAX_NAMED), removed: incoming.removed.slice(0, MAX_NAMED) };
  const merge = (a: ChangeParty[], b: ChangeParty[]) => {
    const m = new Map<string, ChangeParty>();
    for (const p of [...a, ...b]) m.set(p.uid, p);
    return m;
  };
  const added = merge(existing.added, incoming.added);
  const removed = merge(existing.removed, incoming.removed);
  for (const uid of [...added.keys()]) {
    if (removed.has(uid) && incoming.removed.some((p) => p.uid === uid) && existing.added.some((p) => p.uid === uid)) {
      added.delete(uid);
      removed.delete(uid);
    }
  }
  return {
    added: [...added.values()].slice(0, MAX_NAMED),
    removed: [...removed.values()].slice(0, MAX_NAMED),
    addedCount: existing.addedCount + incoming.addedCount,
    removedCount: existing.removedCount + incoming.removedCount,
    updatedCount: existing.updatedCount + incoming.updatedCount,
  };
}

export function recordChanges(file: ChangesFile, date: string, source: ListSource, day: ListDay, now: string): ChangesFile {
  if (!isDate(date)) throw new Error(`bad date ${date}`);
  if (day.addedCount === 0 && day.removedCount === 0 && day.updatedCount === 0) return file;
  const days = { ...file.days, [date]: { ...(file.days[date] ?? {}), [source]: mergeDay(file.days[date]?.[source], day) } };
  return { generatedAt: now, days };
}

export interface DaySummary {
  date: string;
  lists: { source: ListSource; label: string; addedCount: number; removedCount: number; updatedCount: number }[];
  addedTotal: number;
  removedTotal: number;
}
export function summarize(file: ChangesFile, limit = 90): DaySummary[] {
  return Object.keys(file.days)
    .filter(isDate)
    .sort()
    .reverse()
    .slice(0, limit)
    .map((date) => {
      const lists = LIST_SOURCES.flatMap((source) => {
        const d = file.days[date]?.[source];
        return d ? [{ source, label: LIST_META[source].label, addedCount: d.addedCount, removedCount: d.removedCount, updatedCount: d.updatedCount }] : [];
      });
      return { date, lists, addedTotal: lists.reduce((n, l) => n + l.addedCount, 0), removedTotal: lists.reduce((n, l) => n + l.removedCount, 0) };
    });
}

const esc = (v: unknown) =>
  String(v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** RSS 2.0, one item per day with a permalink; the description lists the parties. */
export function buildChangesRss(file: ChangesFile, origin: string, limit = 30): string {
  const days = summarize(file, limit);
  const items = days
    .map((s) => {
      const day = file.days[s.date]!;
      const lines: string[] = [];
      for (const l of s.lists) {
        const d = day[l.source]!;
        const names = (xs: ChangeParty[]) => xs.slice(0, 25).map((p) => p.name ?? `entry ${p.uid} (name not recorded)`).join('; ');
        lines.push(`${l.label}: ${l.addedCount} added, ${l.removedCount} removed, ${l.updatedCount} updated.`);
        if (d.added.length) lines.push(`Added: ${names(d.added)}${d.addedCount > 25 ? ' ...' : ''}`);
        if (d.removed.length) lines.push(`Removed: ${names(d.removed)}${d.removedCount > 25 ? ' ...' : ''}`);
      }
      const link = `${origin}/changes/${s.date}`;
      return `    <item>
      <title>${esc(`List changes ${s.date}: ${s.addedTotal} added, ${s.removedTotal} removed`)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${new Date(`${s.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(lines.join('\n'))}</description>
    </item>`;
    })
    .join('\n');
  const built = days[0] ? new Date(`${days[0].date}T12:00:00Z`).toUTCString() : new Date(0).toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Aex Terminal: sanctions and screening list changes</title>
    <link>${esc(origin)}/changes</link>
    <description>Parties added to and removed from the OFAC SDN list, the Consolidated Screening List (including the Entity List), the UN list and the UK list, per day. Derived by comparing the official files each day; confirm against the official list before relying on it.</description>
    <language>en-us</language>
    <lastBuildDate>${built}</lastBuildDate>
    <atom:link href="${esc(origin)}/changes.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
