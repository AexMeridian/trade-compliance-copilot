// Daily sanctions-list sync, run by .github/workflows/lists-sync.yml (or by hand: `npx tsx scripts/sync-lists.ts`).
//
// Why this exists: the OFAC SDN file is about 30 MB, the Consolidated Screening List 17 MB and the UK list 22 MB. Parsing them inside the
// Worker's scheduled job exceeds the Workers Free CPU budget, so the job was killed before it could even log a failure and the lists went
// stale (SDN never refreshed after its 2026-09-23 seed; CSL and UN stopped on 2026-10-04; the UK list never loaded). GitHub Actions has no
// such limit and needs no Cloudflare secret: this script downloads and parses each list there, compares it with the snapshot of what was
// last sent (data/lists/<list>.json, one short fingerprint per entry), and writes a numbered D1 migration that changes only the entries
// that are new, changed or gone. Committing it to main deploys the site and applies the migration (the build command runs
// `wrangler d1 migrations apply --remote`), so the live tables update with no secret and no model call.
//
// The SQL is idempotent and writes only what differs, so it is safe the first time too, when there is no snapshot yet and the stored
// copy is weeks old: every entry is upserted with a WHERE that skips unchanged rows (an unchanged row costs reads, not writes), aliases
// are added or removed one by one, and entries no longer on the list are removed by key range. D1's free tier allows 100,000 rows
// written per day, counting index and search-index entries, so a run stops adding lists once its estimate passes DAILY_WRITE_BUDGET;
// the rest wait for the next day. The parsing is the Worker's own (src/lib/refresh/*), so the stored rows have the same shape.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { normalizeNameString } from '../src/lib/normalize.js';
import { sqlString } from '../src/lib/refresh/sql.js';
import { parseCsvLine } from '../src/lib/refresh/csv.js';
import { toRecord, type SdnEntry } from '../src/lib/refresh/sdn.js';
import { tagBlocks, parseIndividual, parseEntity } from '../src/lib/refresh/unSanctions.js';
import { parseDesignation } from '../src/lib/refresh/ukSanctions.js';
import { USER_AGENT } from '../src/lib/refresh/userAgent.js';

const DAILY_WRITE_BUDGET = 70_000;
const MAX_FILE_BYTES = 1_500_000; // one migration file per ~1.5 MB of SQL; each file is applied in its own transaction
const MAX_STATEMENT_BYTES = 80_000; // D1 refuses a single statement over 100 KB
const SNAPSHOT_DIR = 'data/lists';
const MIGRATIONS_DIR = 'migrations';

type Value = string | number | null;
interface Rec {
  uid: string;
  values: Record<string, Value>; // entry columns other than uid, source_tier and last_updated
  aliases: { alias: string; type: Value }[];
}
interface ListSpec {
  source: 'sdn' | 'csl' | 'un_sanctions' | 'uk_sanctions';
  label: string;
  entries: string;
  aliases: string;
  fk: string;
  aliasHasType: boolean;
  /** Rough writes for one new entry (row, unique index, search index) and one alias (row, search index). */
  fetch: () => Promise<{ records: Rec[]; publishDate: string | null }>;
}

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

function dedupeAliases(aliases: { alias: string; type: Value }[], primary: string): { alias: string; type: Value }[] {
  const seen = new Set<string>();
  const out: { alias: string; type: Value }[] = [];
  for (const a of aliases) {
    const alias = a.alias.trim();
    const k = `${alias}\u0001${a.type ?? ''}`;
    if (!alias || alias === primary || seen.has(k)) continue;
    seen.add(k);
    out.push({ alias, type: a.type ?? null });
  }
  return out;
}

/** Keeps the first record for each key: the stored tables have a unique key and the feeds occasionally repeat one. */
function uniqueByUid(records: Rec[]): Rec[] {
  const seen = new Set<string>();
  return records.filter((r) => (seen.has(r.uid) ? false : (seen.add(r.uid), true)));
}

const LISTS: ListSpec[] = [
  {
    source: 'sdn',
    label: 'OFAC SDN',
    entries: 'sdn_entries',
    aliases: 'sdn_aliases',
    fk: 'sdn_id',
    aliasHasType: true,
    fetch: async () => {
      const xml = await (await get('https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML')).text();
      const publishDate = /<Publish_Date>([^<]+)<\/Publish_Date>/.exec(xml)?.[1] ?? null;
      const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, isArray: (n) => n === 'sdnEntry' });
      const parsed = parser.parse(xml) as { sdnList?: { sdnEntry?: SdnEntry[] } };
      const entries = parsed.sdnList?.sdnEntry ?? [];
      const SOURCE_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';
      const records = entries.map((e): Rec => {
        const r = toRecord(e);
        return {
          uid: r.uid,
          values: {
            primary_name: r.name,
            name_normalized: normalizeNameString(r.name),
            entity_type: r.type,
            programs: r.programs,
            dob: r.dob,
            place_of_birth: r.placeOfBirth,
            addresses: r.addresses,
            remarks: r.remarks,
            source_url: SOURCE_URL,
          },
          aliases: dedupeAliases(r.aliases.map((a) => ({ alias: a.name, type: a.type })), ''),
        };
      });
      return { records: uniqueByUid(records), publishDate };
    },
  },
  {
    source: 'un_sanctions',
    label: 'UN Security Council list',
    entries: 'un_sanctions_entries',
    aliases: 'un_sanctions_aliases',
    fk: 'un_id',
    aliasHasType: true,
    fetch: async () => {
      const xml = await (await get('https://scsanctions.un.org/resources/xml/en/consolidated.xml')).text();
      if (!xml.includes('<CONSOLIDATED_LIST')) throw new Error('UN list did not look like the expected XML');
      const publishDate = /dateGenerated="([^"]+)"/.exec(xml)?.[1]?.slice(0, 10) ?? null;
      const parsed = [...tagBlocks(xml, 'INDIVIDUAL').map(parseIndividual), ...tagBlocks(xml, 'ENTITY').map(parseEntity)].filter((r) => r.name && r.dataId);
      const records = parsed.map(
        (r): Rec => ({
          uid: String(r.dataId),
          values: {
            entity_type: r.entityType,
            primary_name: r.name,
            name_normalized: normalizeNameString(r.name),
            un_list_type: r.listType,
            reference_number: r.referenceNumber,
            listed_on: r.listedOn,
            nationality: r.nationality,
            addresses: r.addresses,
            remarks: r.remarks,
            source_url: 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list',
          },
          aliases: dedupeAliases(r.aliases.map((a) => ({ alias: a.alias, type: a.aliasType })), ''),
        })
      );
      return { records: uniqueByUid(records), publishDate };
    },
  },
  {
    source: 'csl',
    label: 'Consolidated Screening List',
    entries: 'csl_entries',
    aliases: 'csl_aliases',
    fk: 'csl_id',
    aliasHasType: false,
    fetch: async () => {
      const text = await (await get('https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv')).text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const header = parseCsvLine(lines[0]).map((h) => h.trim());
      const col = (name: string) => {
        const i = header.indexOf(name);
        if (i < 0) throw new Error(`CSL column "${name}" is missing; the file layout changed`);
        return i;
      };
      const C = {
        id: col('_id'), source: col('source'), name: col('name'), addresses: col('addresses'), frn: col('federal_register_notice'),
        start: col('start_date'), licReq: col('license_requirement'), licPol: col('license_policy'), alt: col('alt_names'), url: col('source_information_url'),
      };
      const records: Rec[] = [];
      for (const line of lines.slice(1)) {
        const f = parseCsvLine(line);
        const source = f[C.source]?.trim();
        const name = f[C.name]?.trim();
        const id = f[C.id]?.trim();
        // The CSL re-publishes OFAC's SDN list; that list is loaded directly from OFAC (same rule as src/lib/refresh/csl.ts).
        if (!id || !source || !name || source === 'Specially Designated Nationals (SDN) - Treasury Department') continue;
        records.push({
          uid: id,
          values: {
            source_list: source,
            name,
            name_normalized: normalizeNameString(name),
            addresses: f[C.addresses] || null,
            federal_register_notice: f[C.frn] || null,
            license_requirement: f[C.licReq] || null,
            license_policy: f[C.licPol] || null,
            start_date: f[C.start] || null,
            source_url: f[C.url]?.trim() || 'https://www.trade.gov/consolidated-screening-list',
          },
          aliases: dedupeAliases((f[C.alt] || '').split(';').map((s) => ({ alias: s, type: null })), name),
        });
      }
      return { records: uniqueByUid(records), publishDate: null };
    },
  },
  {
    source: 'uk_sanctions',
    label: 'UK Sanctions List',
    entries: 'uk_sanctions_entries',
    aliases: 'uk_sanctions_aliases',
    fk: 'uk_id',
    aliasHasType: true,
    fetch: async () => {
      const xml = await (await get('https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml')).text();
      const publishDate = /<DateGenerated>([^<]+)<\/DateGenerated>/.exec(xml)?.[1]?.slice(0, 10) ?? null;
      const blocks = xml.match(/<Designation>[\s\S]*?<\/Designation>/g) ?? [];
      const records: Rec[] = [];
      for (const b of blocks) {
        const d = parseDesignation(b);
        if (!d) continue;
        records.push({
          uid: d.uid,
          values: {
            group_id: d.groupId,
            entity_type: d.entityType,
            primary_name: d.primaryName,
            name_normalized: normalizeNameString(d.primaryName),
            regime_name: d.regimeName,
            listing_type: d.listingType,
            date_listed: d.dateListed,
            addresses: d.address,
            statement_of_reasons: d.statementOfReasons,
            source_url: 'https://sanctionslist.fcdo.gov.uk',
          },
          aliases: dedupeAliases(d.aliases.map((a) => ({ alias: a.name, type: a.type })), d.primaryName),
        });
      }
      if (records.length === 0) throw new Error('UK list produced no designations; the file layout may have changed');
      return { records: uniqueByUid(records), publishDate };
    },
  },
];

const sig = (r: Rec) => createHash('sha1').update(JSON.stringify([r.values, r.aliases.map((a) => `${a.alias}\u0001${a.type ?? ''}`).sort()])).digest('base64url').slice(0, 12);
const sqlValue = (v: Value) => (typeof v === 'number' ? String(v) : sqlString(v));
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

/** Splits rows into statements under MAX_STATEMENT_BYTES. */
function chunked<T>(items: T[], render: (part: T[]) => string, maxRows: number): string[] {
  const out: string[] = [];
  let part: T[] = [];
  for (const item of items) {
    part.push(item);
    if (part.length >= maxRows || bytes(render(part)) > MAX_STATEMENT_BYTES) {
      if (part.length > 1) {
        const last = part.pop()!;
        out.push(render(part));
        part = [last];
      } else {
        out.push(render(part));
        part = [];
      }
    }
  }
  if (part.length) out.push(render(part));
  return out;
}

/** SQL that makes the stored table hold `records` (upsert, alias sync), plus removals. */
function buildSql(spec: ListSpec, records: Rec[], removal: { mode: 'explicit'; uids: string[] } | { mode: 'reconcile'; allUids: string[] }, today: string): string[] {
  const out: string[] = [];
  const cols = records.length ? Object.keys(records[0].values) : [];
  const T = spec.entries;
  const A = spec.aliases;

  // Removals first, so a key that moved is never briefly duplicated.
  if (removal.mode === 'explicit') {
    for (const part of chunked(removal.uids, (p) => p.map(sqlString).join(','), 400)) {
      out.push(`DELETE FROM ${A} WHERE ${spec.fk} IN (SELECT id FROM ${T} WHERE uid IN (${part}));`);
      out.push(`DELETE FROM ${T} WHERE uid IN (${part});`);
    }
  } else {
    // CSL rows stored before keys existed have no uid. Give each one the key of the matching new entry (same list, name and start date),
    // one row per statement so two identical rows can never receive the same key; this costs far fewer writes than deleting and
    // re-inserting the table. Rows that match nothing are removed just below.
    if (spec.source === 'csl') {
      for (const r of records) {
        out.push(
          `UPDATE ${T} SET uid = ${sqlString(r.uid)} WHERE id = (SELECT MIN(id) FROM ${T} WHERE uid IS NULL AND source_list = ${sqlValue(r.values.source_list)} ` +
            `AND name = ${sqlValue(r.values.name)} AND start_date IS ${sqlValue(r.values.start_date)}) AND NOT EXISTS (SELECT 1 FROM ${T} WHERE uid = ${sqlString(r.uid)});`
        );
      }
    }
    out.push(`DELETE FROM ${A} WHERE ${spec.fk} IN (SELECT id FROM ${T} WHERE uid IS NULL);`);
    out.push(`DELETE FROM ${T} WHERE uid IS NULL;`);
    // Everything not in the new list, by key range: SQLite compares TEXT byte by byte, the same order as this sort.
    const sorted = [...removal.allUids].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const groups: string[][] = [];
    for (let i = 0; i < sorted.length; i += 400) groups.push(sorted.slice(i, i + 400));
    if (groups.length) {
      const pred = (lo: string | null, hi: string | null, keep: string[] | null) =>
        [lo !== null ? `uid >= ${sqlString(lo)}` : null, hi !== null ? `uid < ${sqlString(hi)}` : null, keep ? `uid NOT IN (${keep.map(sqlString).join(',')})` : null].filter(Boolean).join(' AND ');
      const preds = [pred(null, groups[0][0], null), ...groups.map((g, i) => pred(g[0], groups[i + 1]?.[0] ?? null, g))];
      for (const p of preds) {
        out.push(`DELETE FROM ${A} WHERE ${spec.fk} IN (SELECT id FROM ${T} WHERE ${p});`);
        out.push(`DELETE FROM ${T} WHERE ${p};`);
      }
    }
    out.push(`DELETE FROM ${A} WHERE ${spec.fk} NOT IN (SELECT id FROM ${T});`);
  }

  if (records.length) {
    // Upsert: an unchanged row matches the WHERE false and is not written.
    const head = `INSERT INTO ${T} (uid, ${cols.join(', ')}, source_tier, last_updated) VALUES`;
    const tail =
      `ON CONFLICT(uid) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}, last_updated = excluded.last_updated ` +
      `WHERE ${cols.map((c) => `${T}.${c} IS NOT excluded.${c}`).join(' OR ')};`;
    const row = (r: Rec) => `(${sqlString(r.uid)}, ${cols.map((c) => sqlValue(r.values[c] ?? null)).join(', ')}, 1, ${sqlString(today)})`;
    out.push(...chunked(records, (p) => `${head}\n${p.map(row).join(',\n')}\n${tail}`, 150));

    // Aliases: add the missing ones, then remove the ones no longer listed, entry by entry.
    const typeCol = spec.aliasHasType ? ', alias_type' : '';
    const pairs = records.flatMap((r) => r.aliases.map((a) => ({ uid: r.uid, ...a })));
    const pairRow = (p: { uid: string; alias: string; type: Value }) =>
      `(${sqlString(p.uid)}, ${sqlString(p.alias)}, ${sqlString(normalizeNameString(p.alias))}, ${sqlValue(p.type)})`;
    out.push(
      ...chunked(
        pairs,
        (p) =>
          `WITH v(uid, alias, norm, typ) AS (VALUES ${p.map(pairRow).join(',\n')})\n` +
          `INSERT INTO ${A} (${spec.fk}, alias, alias_normalized${typeCol}) SELECT e.id, v.alias, v.norm${spec.aliasHasType ? ', v.typ' : ''} FROM v JOIN ${T} e ON e.uid = v.uid ` +
          `WHERE NOT EXISTS (SELECT 1 FROM ${A} a WHERE a.${spec.fk} = e.id AND a.alias = v.alias${spec.aliasHasType ? ' AND a.alias_type IS v.typ' : ''});`,
        250
      )
    );
    out.push(
      ...chunked(
        records,
        (p) => {
          const keep = p.flatMap((r) => r.aliases.map((a) => `(${sqlString(r.uid)}, ${sqlString(a.alias)}, ${sqlValue(a.type)})`));
          return (
            `WITH v(uid, alias, typ) AS (VALUES ${keep.length ? keep.join(',\n') : '(NULL, NULL, NULL)'})\n` +
            `DELETE FROM ${A} WHERE id IN (SELECT a.id FROM ${A} a JOIN ${T} e ON e.id = a.${spec.fk} WHERE e.uid IN (${p.map((r) => sqlString(r.uid)).join(',')}) ` +
            `AND NOT EXISTS (SELECT 1 FROM v WHERE v.uid = e.uid AND v.alias = a.alias${spec.aliasHasType ? ' AND v.typ IS a.alias_type' : ''}));`
          );
        },
        150
      )
    );
  }
  return out;
}

interface Snapshot {
  source: string;
  syncedAt: string;
  publishDate: string | null;
  count: number;
  sigs: Record<string, string>;
}

function nextMigrationNumber(): number {
  const nums = readdirSync(MIGRATIONS_DIR)
    .map((f) => /^(\d{4})_/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number);
  return Math.max(0, ...nums) + 1;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const only = process.argv.slice(2).filter((a: string) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  mkdirSync(SNAPSHOT_DIR, { recursive: true });

  let budget = DAILY_WRITE_BUDGET;
  const statements: { source: string; sql: string[] }[] = [];
  const snapshots: Snapshot[] = [];
  const summary: string[] = [];

  for (const spec of LISTS) {
    if (only.length && !only.includes(spec.source)) continue;
    let fetched: { records: Rec[]; publishDate: string | null };
    try {
      fetched = await spec.fetch();
    } catch (err) {
      summary.push(`${spec.source}: fetch failed (${err instanceof Error ? err.message : String(err)}); left as is`);
      continue;
    }
    const { records, publishDate } = fetched;
    const path = `${SNAPSHOT_DIR}/${spec.source}.json`;
    const prev: Snapshot | null = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Snapshot) : null;
    if (prev && records.length < prev.count * 0.8) {
      summary.push(`${spec.source}: refused, ${records.length} entries is far fewer than the ${prev.count} last loaded (a partial download?)`);
      continue;
    }
    const sigs: Record<string, string> = {};
    for (const r of records) sigs[r.uid] = sig(r);

    let sql: string[];
    let estimate: number;
    let changed: number;
    if (prev) {
      const changedRecs = records.filter((r) => prev.sigs[r.uid] !== sigs[r.uid]);
      const removed = Object.keys(prev.sigs).filter((u) => !(u in sigs));
      changed = changedRecs.length + removed.length;
      if (changed === 0) {
        summary.push(`${spec.source}: unchanged (${records.length} entries)`);
        continue;
      }
      sql = buildSql(spec, changedRecs, { mode: 'explicit', uids: removed }, today);
      estimate = changedRecs.reduce((n, r) => n + 6 + r.aliases.length * 4, 0) + removed.length * 10;
    } else {
      // First sync: the stored copy is unknown, so every entry is reconciled; only differences are written.
      changed = records.length;
      sql = buildSql(spec, records, { mode: 'reconcile', allUids: records.map((r) => r.uid) }, today);
      // An empty table (UK) is a full insert; CSL rows get their key (about 4 writes each: row, key index, search index) plus changes;
      // SDN and UN already hold a recent copy, so only the differences since then are written.
      estimate =
        spec.source === 'uk_sanctions'
          ? records.reduce((n, r) => n + 6 + r.aliases.length * 4, 0)
          : spec.source === 'csl'
            ? records.length * 5
            : spec.source === 'sdn'
              ? 25_000
              : 10_000;
    }
    if (statements.length > 0 && estimate > budget) {
      summary.push(`${spec.source}: ${changed} changes (about ${estimate} writes) wait for the next run to stay inside the daily write limit`);
      continue;
    }
    budget -= estimate;
    sql.push(
      `INSERT INTO data_refresh_log (source, status, rows_affected, error_message, started_at, finished_at) VALUES (${sqlString(spec.source)}, 'success', ${changed}, ${sqlString(
        `Loaded by the daily list sync (GitHub Actions)${publishDate ? `; list published ${publishDate}` : ''}`
      )}, ${sqlString(new Date().toISOString())}, ${sqlString(new Date().toISOString())});`
    );
    statements.push({ source: spec.source, sql });
    snapshots.push({ source: spec.source, syncedAt: new Date().toISOString(), publishDate, count: records.length, sigs });
    summary.push(`${spec.source}: ${records.length} entries, ${changed} to write${prev ? '' : ' (first sync)'}, about ${estimate} rows written`);
  }

  console.log(summary.join('\n'));
  if (statements.length === 0 || dryRun) return;

  // Group into files under MAX_FILE_BYTES, never splitting a list's log row from its own statements' file order.
  let n = nextMigrationNumber();
  let part: string[] = [];
  let size = 0;
  const sources = statements.map((s) => s.source).join(', ');
  const header = (i: number) =>
    `-- Sanctions-list sync ${today} (part ${i}): ${sources}. Generated by scripts/sync-lists.ts from the official files; writes only entries that\n` +
    `-- are new, changed or gone. Safe to re-run: every statement is an idempotent upsert or a keyed delete.\n\n`;
  let fileIndex = 1;
  const flush = () => {
    if (!part.length) return;
    const name = `${MIGRATIONS_DIR}/${String(n).padStart(4, '0')}_lists_sync_${today.replace(/-/g, '')}_${fileIndex}.sql`;
    writeFileSync(name, header(fileIndex) + part.join('\n') + '\n');
    console.log(`wrote ${name} (${Math.round(size / 1024)} KB)`);
    n++;
    fileIndex++;
    part = [];
    size = 0;
  };
  for (const s of statements) {
    for (const stmt of s.sql) {
      if (size + bytes(stmt) > MAX_FILE_BYTES) flush();
      part.push(stmt);
      size += bytes(stmt) + 1;
    }
  }
  flush();
  for (const snap of snapshots) writeFileSync(`${SNAPSHOT_DIR}/${snap.source}.json`, JSON.stringify(snap) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
