// HTS, Schedule B and cross-reference sync, run by .github/workflows/bulk-sync.yml (or by hand: `npx tsx scripts/sync-bulk-data.ts --dry-run`).
//
// Why this exists: the Worker's own HTS job needs 96 requests (a Workers Free invocation may make 50) and every full reload writes far more rows
// than D1 Free's 100,000-writes-a-day allowance, so hts never succeeded and schedule_b went stale. Here the official files are downloaded and parsed
// on a GitHub Actions runner, compared with the committed snapshot of what the database holds (data/bulk/*.json), and only the difference is written as a
// numbered D1 migration. Committing it to main deploys the site and the build step applies the migration, the same mechanism as the sanctions-list
// sync (scripts/sync-lists.ts): no Cloudflare secret, no model call, only the automatic GITHUB_TOKEN to push.
//
// Per chapter: a chapter not in the snapshot yet is replaced as a whole (its stored content is unknown), a chapter that is is updated row by row. A run
// spends at most --budget estimated D1 writes (default 55,000, leaving the rest of the day for the site's own writes); what does not fit waits for the next
// run, so the first load of the whole HTS takes several daily runs and every later run is small. Each source gets a data_refresh_log row in the migration, so
// /api/health and /api/pulse/data-status see it. Safety equivalent to the Worker jobs' (src/lib/refresh/guards.ts): a download far smaller than the last
// complete one is refused, and nothing is written for a chapter that failed to download.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCsvLine } from '../src/lib/refresh/csv.js';
import { shrinkError } from '../src/lib/refresh/guards.js';
import { USER_AGENT } from '../src/lib/refresh/userAgent.js';
import {
  DEFAULT_WRITE_BUDGET, HTS_CHAPTERS, HTS_SPEC, SCHEDULE_B_SPEC, SCHEDULE_B_URL,
  bootstrapUnit, buildChapter, chap2, chapterShrunk, deltaUnit, diffChapter, emptyTableSnap, emptyXrefSnap, fingerprint, groupUnits,
  heartbeatDue, htsChapterUrl, htsDrafts, logRowSql, pickUnits, scheduleBDrafts, snapOf, xrefPairs, xrefUnit,
  type ChapterSnap, type HtsApiRow, type TableSnap, type Unit, type XrefSnap,
} from './lib/bulkSync.js';

const DIR = 'data/bulk';
const MIGRATIONS_DIR = 'migrations';
const args: string[] = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const option = (n: string) => args.find((a) => a.startsWith(`${n}=`))?.slice(n.length + 1);
const DRY = flag('--dry-run');
const DAY_BUDGET = Number(option('--budget') ?? DEFAULT_WRITE_BUDGET);
const ONLY = (option('--only') ?? 'hts,schedule_b').split(',').map((s: string) => s.trim());
const today = new Date().toISOString().slice(0, 10);
const nowIso = new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string, what: string): Promise<{ text: string; lastModified: string | null }> {
  let last = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) return { text: await res.text(), lastModified: res.headers.get('last-modified') };
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await sleep(2000 * attempt);
  }
  throw new Error(`${what}: ${last} from ${url}`);
}

function loadSnap(name: string): TableSnap {
  const path = `${DIR}/${name}.json`;
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as TableSnap) : emptyTableSnap(name);
}
const loadXrefSnap = (): XrefSnap => (existsSync(`${DIR}/xref.json`) ? (JSON.parse(readFileSync(`${DIR}/xref.json`, 'utf8')) as XrefSnap) : emptyXrefSnap());

/** One chapter per line, so a revision shows as a small git diff. */
function writeSnap(name: string, snap: TableSnap | XrefSnap) {
  const { chapters, ...head } = snap as unknown as { chapters: Record<string, unknown> } & Record<string, unknown>;
  const lines = Object.keys(chapters)
    .sort()
    .map((c) => `${JSON.stringify(c)}:${JSON.stringify(chapters[c])}`);
  writeFileSync(`${DIR}/${name}.json`, `${JSON.stringify(head).slice(0, -1)},"chapters":{\n${lines.join(',\n')}\n}}\n`);
}

function nextMigrationNumber(): number {
  const nums = readdirSync(MIGRATIONS_DIR).map((f) => /^(\d{4})_/.exec(f)?.[1]).filter(Boolean).map(Number);
  return Math.max(0, ...nums) + 1;
}

interface Pending {
  unit: Unit;
  source: 'hts' | 'schedule_b';
  chapter: string;
  commit: () => void;
}

/** Writes already spent today (UTC) by earlier runs of this script, so two manual runs in one day cannot together pass the daily allowance. */
function spentToday(): number {
  try {
    const b = JSON.parse(readFileSync(`${DIR}/budget.json`, 'utf8')) as { date: string; writes: number };
    return b.date === today ? b.writes : 0;
  } catch {
    return 0;
  }
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const alreadySpent = spentToday();
  const BUDGET = Math.max(0, DAY_BUDGET - alreadySpent);
  const failures: string[] = [];
  const summary: string[] = [];
  const snaps: Record<string, TableSnap> = { hts: loadSnap('hts'), schedule_b: loadSnap('schedule_b') };
  const next: Record<string, TableSnap> = {
    hts: structuredClone(snaps.hts),
    schedule_b: structuredClone(snaps.schedule_b),
  };
  const pending: Pending[] = [];
  const totals: Record<string, number> = {};

  const consider = (source: 'hts' | 'schedule_b', chapter: number, drafts: ReturnType<typeof htsDrafts>, fp: string) => {
    const spec = source === 'hts' ? HTS_SPEC : SCHEDULE_B_SPEC;
    const ch = chap2(chapter);
    const prev = snaps[source].chapters[ch] ?? null;
    if (prev && chapterShrunk(Object.keys(prev.rows).length, drafts.length)) {
      failures.push(`${source} chapter ${ch}: ${drafts.length} lines against ${Object.keys(prev.rows).length} last time (a truncated download?); left as is`);
      return;
    }
    const built = buildChapter(spec, chapter, drafts, prev, source === 'hts');
    totals[source] = (totals[source] ?? 0) + built.rows.length;
    if (prev && prev.fp === fp) return; // unchanged chapter
    const commit = () => {
      next[source].chapters[ch] = snapOf(built.rows, built.next, fp);
    };
    if (!prev) pending.push({ unit: bootstrapUnit(source, spec, ch, built.rows), source, chapter: ch, commit });
    else {
      const diff = diffChapter(prev, built.rows);
      const unit = deltaUnit(source, spec, ch, diff);
      if (unit) pending.push({ unit, source, chapter: ch, commit });
      else commit(); // same rows under a new fingerprint (e.g. a stamp-only change): remember it, write nothing
    }
  };

  const completeTotals: Record<string, boolean> = { hts: false, schedule_b: false };

  if (ONLY.includes('hts')) {
    let failed = 0;
    for (const chapter of HTS_CHAPTERS) {
      try {
        const { text } = await fetchText(htsChapterUrl(chapter), `HTS chapter ${chapter}`);
        if (!text.trim().startsWith('[')) throw new Error(`HTS chapter ${chapter}: unexpected non-JSON-array response: ${text.slice(0, 120)}`);
        const api = JSON.parse(text) as HtsApiRow[];
        if (api.length === 0) continue;
        consider('hts', chapter, htsDrafts(chapter, api, today), fingerprint(text));
      } catch (err) {
        failed++;
        failures.push(err instanceof Error ? err.message : String(err));
      }
      await sleep(300);
    }
    completeTotals.hts = failed === 0;
  }

  if (ONLY.includes('schedule_b')) {
    try {
      const { text, lastModified } = await fetchText(SCHEDULE_B_URL, 'Schedule B');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const header = parseCsvLine(lines[0] ?? '').map((h) => h.trim().toLowerCase());
      if (header[0] !== 'hs') throw new Error(`Unexpected Schedule B CSV header: ${lines[0]}`);
      const byChapter = scheduleBDrafts(lines.slice(1).map(parseCsvLine), today, lastModified);
      // Per-chapter fingerprints from each chapter's own lines.
      const linesBy = new Map<number, string[]>();
      for (const l of lines.slice(1)) {
        const ch = Number(l.slice(0, 2).replace(/"/g, ''));
        linesBy.set(ch, [...(linesBy.get(ch) ?? []), l]);
      }
      for (const [chapter, drafts] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) consider('schedule_b', chapter, drafts, fingerprint((linesBy.get(chapter) ?? []).join('\n')));
      completeTotals.schedule_b = true;
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }

  // Whole-download guard against the last complete download.
  for (const source of ['hts', 'schedule_b'] as const) {
    if (!completeTotals[source]) continue;
    const msg = shrinkError(source, snaps[source].expectedTotal || null, totals[source] ?? 0);
    if (msg) {
      failures.push(msg);
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].source === source) pending.splice(i, 1);
      completeTotals[source] = false;
    } else if ((totals[source] ?? 0) > 0) {
      next[source].expectedTotal = totals[source];
    }
  }

  const { run, deferred } = pickUnits(pending.map((p) => p.unit), BUDGET, alreadySpent === 0);
  const runSet = new Set(run);
  for (const p of pending) if (runSet.has(p.unit)) p.commit();
  const ranUnits = pending.filter((p) => runSet.has(p.unit));

  // Cross-reference, from the snapshots as they will stand after this run.
  const xsnap = loadXrefSnap();
  const xnext: XrefSnap = structuredClone(xsnap);
  const xunits: { unit: Unit; chapter: string; pairs: string[] }[] = [];
  for (const ch of Object.keys(next.hts.chapters)) {
    const s = next.schedule_b.chapters[ch];
    if (!s) continue;
    const pairs = xrefPairs(next.hts.chapters[ch], s);
    if (pairs.length === 0 && !xsnap.chapters[ch]) {
      xnext.chapters[ch] = [];
      continue;
    }
    const unit = xrefUnit(ch, xsnap.chapters[ch], pairs);
    if (unit) xunits.push({ unit, chapter: ch, pairs });
  }
  const spentSoFar = run.reduce((n, u) => n + u.writes, 0);
  const xpick = pickUnits(xunits.map((x) => x.unit), Math.max(0, BUDGET - spentSoFar), run.length === 0 && alreadySpent === 0);
  const xRun = new Set(xpick.run);
  const xRan = xunits.filter((x) => xRun.has(x.unit));
  for (const x of xRan) xnext.chapters[x.chapter] = x.pairs;

  const bySource = (s: string) => ranUnits.filter((p) => p.source === s).map((p) => p.unit);
  const loaded = (s: 'hts' | 'schedule_b') => Object.keys(next[s].chapters).length;
  const logs: string[] = [];
  const logFor = (source: 'hts' | 'schedule_b' | 'xref', units: Unit[], snap: { lastLoggedAt: string | null }, note: string) => {
    const changes = units.reduce((n, u) => n + u.changes, 0);
    if (units.length === 0 && !heartbeatDue(snap.lastLoggedAt, Date.now())) return;
    const writes = units.reduce((n, u) => n + u.writes, 0);
    logs.push(logRowSql(source, changes, writes, note, nowIso));
    snap.lastLoggedAt = nowIso;
  };
  const progress = (s: 'hts' | 'schedule_b') => {
    const total = Object.keys(next[s].chapters).length + deferred.filter((u) => u.label.startsWith(s) && u.kind === 'bootstrap').length;
    return `${loaded(s)} of ${total} chapters loaded`;
  };
  const note = (s: 'hts' | 'schedule_b', units: Unit[]) =>
    `Loaded by the bulk-data sync (GitHub Actions): ${units.length} chapter${units.length === 1 ? '' : 's'} written (${units.filter((u) => u.kind === 'bootstrap').length} first loads); ${progress(s)}; writes estimated, not measured`;
  for (const s of ['hts', 'schedule_b'] as const) if (ONLY.includes(s) && (completeTotals[s] || bySource(s).length > 0)) logFor(s, bySource(s), next[s], note(s, bySource(s)));
  {
    const unitsX = xRan.map((x) => x.unit);
    if (unitsX.length > 0 || Object.keys(xnext.chapters).length > 0) logFor('xref', unitsX, xnext, `Rebuilt by the bulk-data sync (GitHub Actions) from the loaded HTS and Schedule B chapters: ${unitsX.length} chapter${unitsX.length === 1 ? '' : 's'} written; ${Object.keys(xnext.chapters).length} chapters in the table`);
  }

  summary.push(
    `hts: ${Object.keys(next.hts.chapters).length} chapters loaded, ${bySource('hts').length} written this run`,
    `schedule_b: ${Object.keys(next.schedule_b.chapters).length} chapters loaded, ${bySource('schedule_b').length} written this run`,
    `xref: ${xRan.length} chapters written`,
    `estimated writes this run: ${[...run, ...xpick.run].reduce((n, u) => n + u.writes, 0)} (budget ${BUDGET}); deferred to the next run: ${deferred.length + xpick.deferred.length} chapter unit(s)`
  );
  console.log(summary.join('\n'));

  const allUnits = [...ranUnits.map((p) => p.unit), ...xRan.map((x) => x.unit)];
  if (!DRY && (allUnits.length > 0 || logs.length > 0)) {
    const files = allUnits.length ? groupUnits(allUnits) : [[]];
    files[files.length - 1].push(...logs);
    let n = nextMigrationNumber();
    files.forEach((stmts, i) => {
      const name = `${MIGRATIONS_DIR}/${String(n).padStart(4, '0')}_bulk_sync_${today.replace(/-/g, '')}_${i + 1}.sql`;
      writeFileSync(
        name,
        `-- HTS / Schedule B / cross-reference sync ${today} (part ${i + 1} of ${files.length}). Generated by scripts/sync-bulk-data.ts from the official files:\n` +
          `-- first-time chapters are replaced as a whole, later ones change only the lines that differ. Statements are keyed by row id, so re-running is harmless.\n\n` +
          stmts.join('\n') + '\n'
      );
      console.log(`wrote ${name}`);
      n++;
    });
    writeSnap('hts', next.hts);
    writeSnap('schedule_b', next.schedule_b);
    writeSnap('xref', xnext);
    writeFileSync(`${DIR}/budget.json`, `${JSON.stringify({ date: today, writes: alreadySpent + [...run, ...xpick.run].reduce((n, u) => n + u.writes, 0) })}
`);
  }
  if (failures.length) {
    for (const f of failures) console.error(`::error::${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
