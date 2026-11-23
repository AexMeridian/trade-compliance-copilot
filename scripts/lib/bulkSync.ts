// Pure helpers for scripts/sync-bulk-data.ts: turning the official HTS and Schedule B files into rows with STABLE ids, comparing them with a
// committed snapshot of what the database holds, and writing only the difference as SQL. No network, no database, no clock: tests/bulk-sync.test.ts
// covers it directly.
//
// Why stable ids: the old loaders gave every line a positional id (1, 2, 3 ... across the whole schedule), so one new line near the top shifted the
// id of everything after it and a "difference" became a full rewrite (about 7 database writes per row, 32,000 rows; the free plan allows 100,000
// writes a day for everything). Here a row's id is chosen once, from the chapter number and a per-chapter counter (chapter * 100000 + n), and
// remembered in the snapshot under a key made from the row's own content. A new revision therefore touches only the rows that really changed.
//
// The snapshot is the stand-in for reading the live table (the workflow has no database access, like the sanctions-list sync). A chapter that is
// not in the snapshot yet is "bootstrapped": the chapter's rows are replaced wholesale, because what the table holds for it is unknown.
import { createHash } from 'node:crypto';
import { sqlString } from '../../src/lib/refresh/sql.js';

export type Cell = string | number | null;
export const ID_BLOCK = 100_000; // ids for chapter 85 are 8500001 .. 8599999

export interface TableSpec {
  table: string;
  /** Columns that make a row "changed" when they differ (everything but id, which is the key). */
  compare: string[];
  /** Columns written on insert and on change, but not compared (revision label, retrieval date). */
  stamp: string[];
  /** Rough D1 writes for inserting / deleting one row (the row, its indexes and the search-index entries). */
  insertWrites: number;
  deleteWrites: number;
  updateWrites: number;
}

export const HTS_SPEC: TableSpec = {
  table: 'hts_lines',
  compare: ['htsno', 'indent', 'description', 'superior_id', 'units', 'general_rate', 'special_rate', 'other_rate', 'footnotes', 'chapter'],
  stamp: ['revision', 'source_url', 'source_tier', 'last_updated'],
  insertWrites: 10, // row + 2 indexes + search entries + path-index entry
  deleteWrites: 10,
  updateWrites: 6,
};

export const SCHEDULE_B_SPEC: TableSpec = {
  table: 'schedule_b_lines',
  compare: ['code', 'indent', 'description', 'superior_id', 'units', 'hs6', 'chapter'],
  stamp: ['edition', 'source_url', 'source_tier', 'last_updated'],
  insertWrites: 7,
  deleteWrites: 7,
  updateWrites: 5,
};
export const XREF_WRITES_PER_ROW = 4; // the row and its three indexes

/** One snapshot entry per stored row: [id, signature of the compared columns, reference (HTS number or Schedule B code), signature of description and parent (what the path index is built from)]. */
export type SnapEntry = [number, string, string, string];
export interface ChapterSnap {
  /** Fingerprint of this chapter's downloaded text, so an unchanged chapter is skipped without comparing rows. */
  fp: string;
  /** Next unused counter for new ids in this chapter (ids are never reused). */
  next: number;
  rows: Record<string, SnapEntry>;
}
export interface TableSnap {
  source: string;
  /** Rows in the last complete download (the shrink guard compares the next download with this). */
  expectedTotal: number;
  /** When a data_refresh_log row was last written for this source; a quiet source logs again after a few days so health sees it alive. */
  lastLoggedAt: string | null;
  chapters: Record<string, ChapterSnap>;
}
export interface XrefSnap {
  source: 'xref';
  lastLoggedAt: string | null;
  /** Per chapter, the sorted "<hts number>|<schedule b code>" pairs the table holds. */
  chapters: Record<string, string[]>;
}

export const emptyTableSnap = (source: string): TableSnap => ({ source, expectedTotal: 0, lastLoggedAt: null, chapters: {} });
export const emptyXrefSnap = (): XrefSnap => ({ source: 'xref', lastLoggedAt: null, chapters: {} });

const sha = (s: string, n = 12) => createHash('sha1').update(s).digest('base64url').slice(0, n);
export const fingerprint = (s: string) => createHash('sha256').update(s).digest('hex');
export const sqlCell = (v: Cell | undefined): string => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : sqlString(v));

// ---- Building rows ------------------------------------------------------------------------------------------------------------------------

export interface Draft {
  /** Text the row's key is made from (its identity: an edited description is a different row; a rate change is not). */
  keyText: string;
  indent: number;
  ref: string;
  /** All columns except id and superior_id. */
  values: Record<string, Cell>;
}
export interface BuiltRow {
  key: string;
  id: number;
  sig: string;
  tsig: string;
  ref: string;
  /** Every column (compare and stamp) and id. */
  cols: Record<string, Cell>;
}

/**
 * Assigns ids and parents. `prev` is the chapter's snapshot (null the first time): a row whose key is already there keeps its id. Parents come
 * from the indent stack, as in the old loaders; a draft is a child of the nearest earlier row with a smaller indent.
 */
export function buildChapter(spec: TableSpec, chapter: number, drafts: Draft[], prev: ChapterSnap | null, useParents: boolean): { rows: BuiltRow[]; next: number } {
  let next = prev?.next ?? 1;
  const seen = new Map<string, number>();
  const stack: { indent: number; id: number }[] = [];
  const rows: BuiltRow[] = [];
  for (const d of drafts) {
    const base = sha(d.keyText, 10);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const key = n === 1 ? base : `${base}#${n}`;
    let id = prev?.rows[key]?.[0];
    if (id === undefined) {
      if (next >= ID_BLOCK) throw new Error(`${spec.table}: chapter ${chapter} ran out of row ids (${ID_BLOCK - 1} used)`);
      id = chapter * ID_BLOCK + next++;
    }
    while (useParents && stack.length && stack[stack.length - 1].indent >= d.indent) stack.pop();
    const superior = useParents && stack.length ? stack[stack.length - 1].id : null;
    if (useParents) stack.push({ indent: d.indent, id });
    const cols: Record<string, Cell> = { id, ...d.values, indent: d.indent, superior_id: superior };
    const sig = sha(JSON.stringify(spec.compare.map((c) => cols[c] ?? null)));
    const tsig = sha(JSON.stringify([cols.description ?? null, superior]), 6);
    rows.push({ key, id, sig, tsig, ref: d.ref, cols });
  }
  return { rows, next };
}

export interface HtsApiRow {
  htsno: string;
  indent: string;
  description: string;
  units: string[];
  general: string;
  special: string;
  other: string;
  footnotes: unknown[] | null;
}
export const HTS_CHAPTERS = Array.from({ length: 97 }, (_, i) => i + 1).filter((c) => c !== 77);
export const chap2 = (c: number) => String(c).padStart(2, '0');
export const htsChapterUrl = (chapter: number) =>
  `https://hts.usitc.gov/reststop/exportList?from=${chap2(chapter)}00&to=${chap2(chapter + 1)}00&format=JSON&styles=true`;

export function htsDrafts(chapter: number, api: HtsApiRow[], today: string): Draft[] {
  const revision = `USITC HTS, as retrieved ${today}`;
  return api.map((row) => {
    const indent = Number(row.indent) || 0;
    return {
      keyText: `${row.htsno ?? ''}\u0001${indent}\u0001${row.description ?? ''}`,
      indent,
      ref: row.htsno ?? '',
      values: {
        htsno: row.htsno ?? '',
        description: row.description ?? '',
        units: JSON.stringify(row.units ?? []),
        general_rate: row.general ?? '',
        special_rate: row.special ?? '',
        other_rate: row.other ?? '',
        footnotes: JSON.stringify(row.footnotes ?? []),
        chapter: chap2(chapter),
        revision,
        source_url: htsChapterUrl(chapter),
        source_tier: 1,
        last_updated: today,
      },
    };
  });
}

export const SCHEDULE_B_URL = 'https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaescsv.txt';

/** Splits the Schedule B CSV rows (already parsed: code, description, unit 1, unit 2) into per-chapter drafts. Same filtering as src/lib/refresh/scheduleB.ts. */
export function scheduleBDrafts(records: string[][], today: string, lastModified: string | null): Map<number, Draft[]> {
  const edition = lastModified ? `Census Schedule B (AES Filer CSV), file dated ${lastModified}` : `Census Schedule B (AES Filer CSV), as retrieved ${today}`;
  const out = new Map<number, Draft[]>();
  for (const [code, description, auq1, auq2] of records) {
    if (!code || code.length !== 10) continue;
    const chapter = Number(code.slice(0, 2));
    if (!Number.isFinite(chapter)) continue;
    const units = [auq1, auq2].filter((u) => u && u.trim().length > 0);
    const list = out.get(chapter) ?? [];
    list.push({
      keyText: `${code}\u0001${description ?? ''}`,
      indent: 0,
      ref: code,
      values: {
        code,
        description: description ?? '',
        units: JSON.stringify(units),
        hs6: code.slice(0, 6),
        chapter: code.slice(0, 2),
        edition,
        source_url: SCHEDULE_B_URL,
        source_tier: 1,
        last_updated: today,
      },
    });
    out.set(chapter, list);
  }
  return out;
}

// ---- Differences --------------------------------------------------------------------------------------------------------------------------

export interface ChapterDiff {
  added: BuiltRow[];
  changed: BuiltRow[];
  /** Changed rows whose description or parent moved. */
  treeChanged: number;
  removed: { key: string; id: number }[];
  unchanged: number;
}

export function diffChapter(prev: ChapterSnap, rows: BuiltRow[]): ChapterDiff {
  const added: BuiltRow[] = [];
  const changed: BuiltRow[] = [];
  let treeChanged = 0;
  let unchanged = 0;
  const now = new Set<string>();
  for (const r of rows) {
    now.add(r.key);
    const old = prev.rows[r.key];
    if (!old) added.push(r);
    else if (old[1] !== r.sig) {
      changed.push(r);
      if (old[3] !== r.tsig) treeChanged++;
    }
    else unchanged++;
  }
  const removed = Object.entries(prev.rows)
    .filter(([k]) => !now.has(k))
    .map(([key, e]) => ({ key, id: e[0] }));
  return { added, changed, treeChanged, removed, unchanged };
}

export function snapOf(rows: BuiltRow[], next: number, fp: string): ChapterSnap {
  const map: Record<string, SnapEntry> = {};
  for (const r of rows) map[r.key] = [r.id, r.sig, r.ref, r.tsig];
  return { fp, next, rows: map };
}

/** The ancestor-text index for one chapter's lines (see src/lib/refresh/htsPathIndex.ts for the whole-table version). */
export const htsPathIndexSql = (chapter: string) =>
  `WITH RECURSIVE anc(leaf, node, depth) AS (
  SELECT id, superior_id, 1 FROM hts_lines WHERE chapter = ${sqlString(chapter)} AND htsno != '' AND superior_id IS NOT NULL
  UNION ALL
  SELECT anc.leaf, h.superior_id, anc.depth + 1
  FROM anc JOIN hts_lines h ON h.id = anc.node
  WHERE h.superior_id IS NOT NULL AND anc.depth < 8
)
INSERT INTO hts_path_search(rowid, path)
SELECT anc.leaf, group_concat(h.description, ' ')
FROM anc JOIN hts_lines h ON h.id = anc.node
GROUP BY anc.leaf;`;
const htsPathClearSql = (chapter: string) => `DELETE FROM hts_path_search WHERE rowid IN (SELECT id FROM hts_lines WHERE chapter = ${sqlString(chapter)});`;

const insertPrefix = (spec: TableSpec) => `INSERT INTO ${spec.table} (id, ${[...spec.compare, ...spec.stamp].join(', ')}) VALUES`;
const rowValues = (spec: TableSpec, r: BuiltRow) => `(${['id', ...spec.compare, ...spec.stamp].map((c) => sqlCell(r.cols[c])).join(', ')})`;

const MAX_STATEMENT_BYTES = 80_000;
export function insertStatements(spec: TableSpec, rows: BuiltRow[]): string[] {
  const out: string[] = [];
  const prefix = insertPrefix(spec);
  let part: string[] = [];
  let bytes = prefix.length;
  const flush = () => {
    if (part.length) out.push(`${prefix}\n${part.join(',\n')};`);
    part = [];
    bytes = prefix.length;
  };
  for (const r of rows) {
    const v = rowValues(spec, r);
    if (part.length && (part.length >= 150 || bytes + v.length + 2 > MAX_STATEMENT_BYTES)) flush();
    part.push(v);
    bytes += Buffer.byteLength(v) + 2;
  }
  flush();
  return out;
}

export interface Unit {
  /** Human label, e.g. "hts 85". */
  label: string;
  kind: 'delta' | 'bootstrap';
  sql: string[];
  writes: number;
  /** Rows added + changed + removed (or loaded, for a bootstrap). */
  changes: number;
}

/** First load of a chapter: what the table holds for it is unknown, so its rows are replaced as a whole (one file keeps the replacement atomic). */
export function bootstrapUnit(source: 'hts' | 'schedule_b', spec: TableSpec, chapter: string, rows: BuiltRow[]): Unit {
  const sql: string[] = ['PRAGMA defer_foreign_keys = on;'];
  if (source === 'hts') sql.push(htsPathClearSql(chapter));
  sql.push(`DELETE FROM ${spec.table} WHERE chapter = ${sqlString(chapter)};`);
  sql.push(...insertStatements(spec, rows));
  if (source === 'hts') sql.push(htsPathIndexSql(chapter));
  // The old rows of the chapter are unknown; assume about as many as the new ones.
  return { label: `${source} ${chapter}`, kind: 'bootstrap', sql, writes: rows.length * (spec.insertWrites + spec.deleteWrites), changes: rows.length };
}

/** Later runs: only new, changed and gone rows. */
export function deltaUnit(source: 'hts' | 'schedule_b', spec: TableSpec, chapter: string, diff: ChapterDiff): Unit | null {
  const n = diff.added.length + diff.changed.length + diff.removed.length;
  if (n === 0) return null;
  const sql: string[] = ['PRAGMA defer_foreign_keys = on;'];
  // The path text of every line under a changed heading changes with it, so any change to a description or to the tree rebuilds the chapter's index.
  const treeChanged = source === 'hts' && (diff.added.length > 0 || diff.removed.length > 0 || diff.treeChanged > 0);
  if (treeChanged) sql.push(htsPathClearSql(chapter));
  const removedIds = diff.removed.map((r) => r.id).sort((a, b) => b - a);
  // Parents are written first (file order), children after.
  sql.push(...insertStatements(spec, diff.added));
  for (const r of diff.changed) {
    const set = [...spec.compare, ...spec.stamp].map((c) => `${c} = ${sqlCell(r.cols[c])}`).join(', ');
    sql.push(`UPDATE ${spec.table} SET ${set} WHERE id = ${r.id};`);
  }
  for (let i = 0; i < removedIds.length; i += 400) sql.push(`DELETE FROM ${spec.table} WHERE id IN (${removedIds.slice(i, i + 400).join(', ')});`);
  if (treeChanged) {
    sql.push(htsPathIndexSql(chapter));
  }
  const pathWrites = treeChanged ? (diff.added.length + diff.changed.length + diff.unchanged) * 2 : 0;
  const writes = diff.added.length * spec.insertWrites + diff.changed.length * spec.updateWrites + diff.removed.length * spec.deleteWrites + pathWrites;
  return { label: `${source} ${chapter}`, kind: 'delta', sql, writes, changes: n };
}

// ---- Cross-reference ----------------------------------------------------------------------------------------------------------------------

/** The join src/lib/refresh/xref.ts does in SQL, per chapter, from the snapshots: fully specified 10-digit HTS lines paired with Schedule B codes sharing their HS-6. */
export function xrefPairs(hts: ChapterSnap, sb: ChapterSnap): string[] {
  const byHs6 = new Map<string, Set<string>>();
  for (const [, , code] of Object.values(sb.rows)) {
    const set = byHs6.get(code.slice(0, 6)) ?? new Set<string>();
    set.add(code);
    byHs6.set(code.slice(0, 6), set);
  }
  const out = new Set<string>();
  for (const [, , htsno] of Object.values(hts.rows)) {
    const digits = htsno.replace(/\./g, '');
    if (digits.length !== 10) continue;
    for (const code of byHs6.get(digits.slice(0, 6)) ?? []) out.add(`${htsno}|${code}`);
  }
  return [...out].sort();
}

const pair = (p: string) => {
  const [htsno, code] = p.split('|');
  return { htsno, code, hs6: code.slice(0, 6) };
};

export function xrefUnit(chapter: string, prev: string[] | undefined, pairs: string[]): Unit | null {
  const cond = `substr(hs6, 1, 2) = ${sqlString(chapter)}`;
  const row = (p: string) => {
    const x = pair(p);
    return `(${sqlString(x.htsno)}, ${sqlString(x.code)}, ${sqlString(x.hs6)})`;
  };
  const prefix = 'INSERT INTO hts_schedule_b_xref (hts_htsno, schedule_b_code, hs6) VALUES';
  const inserts = (list: string[]) => {
    const out: string[] = [];
    for (let i = 0; i < list.length; i += 200) out.push(`${prefix}\n${list.slice(i, i + 200).map(row).join(',\n')};`);
    return out;
  };
  if (!prev) {
    return { label: `xref ${chapter}`, kind: 'bootstrap', sql: [`DELETE FROM hts_schedule_b_xref WHERE ${cond};`, ...inserts(pairs)], writes: pairs.length * XREF_WRITES_PER_ROW * 2, changes: pairs.length };
  }
  const had = new Set(prev);
  const want = new Set(pairs);
  const add = pairs.filter((p) => !had.has(p));
  const gone = prev.filter((p) => !want.has(p));
  if (add.length + gone.length === 0) return null;
  const sql: string[] = [];
  for (let i = 0; i < gone.length; i += 150) {
    const vals = gone.slice(i, i + 150).map((p) => {
      const x = pair(p);
      return `(${sqlString(x.htsno)}, ${sqlString(x.code)})`;
    });
    sql.push(`DELETE FROM hts_schedule_b_xref WHERE (hts_htsno, schedule_b_code) IN (VALUES ${vals.join(', ')});`);
  }
  sql.push(...inserts(add));
  return { label: `xref ${chapter}`, kind: 'delta', sql, writes: (add.length + gone.length) * XREF_WRITES_PER_ROW, changes: add.length + gone.length };
}

// ---- Budget and guards --------------------------------------------------------------------------------------------------------------------

/** D1 Free: 100,000 rows written per day for the whole account. This job keeps to a share of it and leaves the rest to the site's own writes. */
export const DEFAULT_WRITE_BUDGET = 55_000;
export const HARD_UNIT_LIMIT = 90_000;

/** Delta units first (small, and they keep loaded chapters current), then first loads, smallest first; always at least one unit, stopping before the budget is passed. */
export function pickUnits(units: Unit[], budget: number, forceFirst = true): { run: Unit[]; deferred: Unit[] } {
  const sorted = [...units].sort((a, b) => (a.kind === b.kind ? a.writes - b.writes : a.kind === 'delta' ? -1 : 1));
  const run: Unit[] = [];
  const deferred: Unit[] = [];
  let spent = 0;
  for (const u of sorted) {
    if (u.writes > HARD_UNIT_LIMIT) throw new Error(`${u.label}: about ${u.writes} database writes in one piece, more than a free-plan day can hold`);
    if ((forceFirst && run.length === 0) || spent + u.writes <= budget) {
      run.push(u);
      spent += u.writes;
    } else deferred.push(u);
  }
  return { run, deferred };
}

/** A chapter that came back far smaller than the snapshot almost always means a truncated download. */
export function chapterShrunk(prevCount: number, now: number, minRatio = 0.5): boolean {
  return prevCount >= 10 && now < prevCount * minRatio;
}

/** Groups units into files of at most `maxBytes`; a unit is never split across files unless it alone is larger. */
export function groupUnits(units: Unit[], maxBytes = 1_500_000): string[][] {
  const files: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const u of units) {
    const bytes = u.sql.reduce((n, s) => n + Buffer.byteLength(s) + 1, 0);
    if (cur.length && size + bytes > maxBytes) {
      files.push(cur);
      cur = [];
      size = 0;
    }
    if (bytes > maxBytes) {
      // One unit larger than a file: split between statements.
      let part: string[] = cur;
      let psize = size;
      for (const s of u.sql) {
        const b = Buffer.byteLength(s) + 1;
        if (part.length && psize + b > maxBytes) {
          files.push(part);
          part = [];
          psize = 0;
        }
        part.push(s);
        psize += b;
      }
      cur = part;
      size = psize;
    } else {
      cur.push(...u.sql);
      size += bytes;
    }
  }
  if (cur.length) files.push(cur);
  return files;
}

export function logRowSql(source: string, changes: number, writes: number, note: string, nowIso: string): string {
  return (
    `INSERT INTO data_refresh_log (source, status, rows_affected, error_message, started_at, finished_at, rows_written) VALUES ` +
    `(${sqlString(source)}, 'success', ${changes}, ${sqlString(note.slice(0, 480))}, ${sqlString(nowIso)}, ${sqlString(nowIso)}, ${Math.round(writes)});`
  );
}

/** A source that changed nothing still logs once every few days, so the health check sees a live source rather than a silent one. */
export const HEARTBEAT_DAYS = 4;
export const heartbeatDue = (lastLoggedAt: string | null, nowMs: number) => !lastLoggedAt || nowMs - Date.parse(lastLoggedAt) >= HEARTBEAT_DAYS * 86_400_000;
