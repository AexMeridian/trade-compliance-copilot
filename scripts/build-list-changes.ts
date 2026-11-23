// One-off backfill of data/lists/changes.json from git history: `npx tsx scripts/build-list-changes.ts`.
// Each commit of data/lists/<list>.json holds one fingerprint per entry, so the entries that appear or disappear between two commits
// are the parties added or removed that day. Names of added entries are read from the sync migration committed with the snapshot
// (it upserts the full row); a removed entry's name is only known if the same list's earlier migration holds it, otherwise it stays
// unnamed. The first committed snapshot of a list is its baseline, not a change. After this, the daily sync keeps the file current.
// A day already in changes.json is left as it is, so re-running never duplicates anything.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { entryUrl, recordChanges, EMPTY_CHANGES, MAX_NAMED, LIST_SOURCES, type ChangesFile, type ListSource } from '../src/lib/listChanges.js';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const TABLE: Record<ListSource, string> = { sdn: 'sdn_entries', csl: 'csl_entries', un_sanctions: 'un_sanctions_entries', uk_sanctions: 'uk_sanctions_entries' };

/** Reads the leading quoted or NULL values of one `('uid', 'a', NULL, 3, ...` tuple; stops at the end of the tuple. */
export function readTuple(text: string, start: number): string[] {
  const out: string[] = [];
  let i = start + 1; // after "("
  for (;;) {
    while (text[i] === ' ') i++;
    if (text[i] === "'") {
      let v = '';
      i++;
      for (;;) {
        if (text[i] === "'" && text[i + 1] === "'") (v += "'"), (i += 2);
        else if (text[i] === "'") break;
        else v += text[i++];
      }
      i++;
      out.push(v);
    } else {
      const m = /^[^,)]+/.exec(text.slice(i, i + 40));
      out.push(m ? m[0].trim() : '');
      i += m ? m[0].length : 0;
    }
    while (text[i] === ' ') i++;
    if (text[i] === ',') i++;
    else return out;
  }
}

/** uid -> row values from every INSERT INTO <table> (cols) VALUES (...) statement in a migration. */
export function entriesFromMigration(sql: string, table: string): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const re = new RegExp(String.raw`INSERT INTO ${table} \(([^)]*)\) VALUES\s*`, 'g');
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    const cols = m[1].split(',').map((c) => c.trim());
    let i = m.index + m[0].length;
    while (sql[i] === '(') {
      const vals = readTuple(sql, i);
      out.set(vals[0], Object.fromEntries(cols.map((c, k) => [c, vals[k] ?? ''])));
      // skip to the end of this tuple: the next "),\n(" or ")\nON CONFLICT"
      const end = sql.indexOf(`\n`, i);
      i = end < 0 ? sql.length : end + 1;
      if (sql.startsWith(',', i)) i++;
      while (sql[i] === '\n' || sql[i] === ' ') i++;
    }
  }
  return out;
}

function main() {
  const file = 'data/lists/changes.json';
  let changes: ChangesFile = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ChangesFile) : EMPTY_CHANGES;
  const seenDays = new Set(Object.keys(changes.days));
  for (const source of LIST_SOURCES) {
    const log = git('log', '--reverse', '--format=%H %cs', '--', `data/lists/${source}.json`)
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(' '));
    let prev: Record<string, string> | null = null;
    const known = new Map<string, string>(); // uid -> name seen in any migration so far
    for (const [hash, date] of log) {
      const snap = JSON.parse(git('show', `${hash}:data/lists/${source}.json`)) as { sigs: Record<string, string> };
      const rows = new Map<string, Record<string, string>>();
      for (const f of git('show', '--name-only', '--format=', hash).split('\n').filter((f) => /^migrations\/\d+_lists_sync_/.test(f))) {
        for (const [uid, v] of entriesFromMigration(git('show', `${hash}:${f}`), TABLE[source])) rows.set(uid, v);
      }
      for (const [uid, v] of rows) known.set(uid, v.primary_name || v.name || '');
      if (prev && !seenDays.has(date)) {
        const added = Object.keys(snap.sigs).filter((u) => !(u in prev!));
        const removed = Object.keys(prev).filter((u) => !(u in snap.sigs));
        const updated = Object.keys(snap.sigs).filter((u) => u in prev! && prev![u] !== snap.sigs[u]).length;
        const detailKey = source === 'sdn' ? 'programs' : source === 'csl' ? 'source_list' : source === 'un_sanctions' ? 'un_list_type' : 'regime_name';
        changes = recordChanges(
          changes,
          date,
          source,
          {
            added: added.slice(0, MAX_NAMED).map((uid) => ({ uid, name: known.get(uid) ?? null, detail: rows.get(uid)?.[detailKey] ?? null, url: entryUrl(source, uid, rows.get(uid)?.source_url) })),
            removed: removed.slice(0, MAX_NAMED).map((uid) => ({ uid, name: known.get(uid) ?? null, url: entryUrl(source, uid, null) })),
            addedCount: added.length,
            removedCount: removed.length,
            updatedCount: updated,
          },
          new Date().toISOString()
        );
        console.log(`${date} ${source}: +${added.length} -${removed.length} ~${updated}`);
      } else if (!prev) console.log(`${date} ${source}: baseline (${Object.keys(snap.sigs).length} entries)`);
      prev = snap.sigs;
    }
  }
  writeFileSync(file, JSON.stringify(changes, null, 1) + '\n');
}

if (process.argv[1] && /build-list-changes/.test(process.argv[1])) main();
