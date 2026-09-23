// Executes every generated scripts/seed-sql/**/*.sql batch file against D1 via
// `wrangler d1 execute --file=...`, sequentially (D1 serializes writes at the
// storage layer anyway, and sequential execution keeps failures easy to
// attribute to a specific file/chapter). Pass --local or --remote.
//
// This is intentionally separate from `wrangler d1 migrations apply`: these
// files are bulk reference-data loads (tens of thousands of rows), not schema
// migrations, and are meant to be re-run whenever the underlying source data
// is refreshed (see scripts/refresh_data.md) without touching migration history.

import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DB_NAME = 'trade-compliance-db';
const DIRS = [
  'scripts/seed-sql/hts',
  'scripts/seed-sql/schedule_b',
  'scripts/seed-sql/xref', // must run after both hts and schedule_b are loaded
  'scripts/seed-sql/sdn',
  'scripts/seed-sql/csl',
];

function main() {
  const mode = process.argv.includes('--remote') ? '--remote' : '--local';
  const onlyArg = process.argv.find((a: string) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
  const dirs = only ? DIRS.filter((d) => only!.some((o: string) => d.endsWith('/' + o))) : DIRS;

  const files: string[] = [];
  for (const dir of dirs) {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      console.warn(`Skipping missing directory: ${dir} (run the matching fetch/build script first)`);
      continue;
    }
    for (const f of entries.sort()) {
      const full = `${dir}/${f}`;
      if (f.endsWith('.sql') && statSync(full).isFile()) files.push(full);
    }
  }

  if (files.length === 0) {
    console.error('No seed-sql files found. Run npm run seed:hts / seed:schedule-b / seed:xref first.');
    process.exit(1);
  }

  console.log(`Loading ${files.length} batch files into ${DB_NAME} (${mode})...`);
  const start = Date.now();
  for (const [i, file] of files.entries()) {
    process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);
    try {
      execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, mode, `--file=${file}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });
      console.log('ok');
    } catch (err: any) {
      console.log('FAILED');
      console.error(err.stdout?.toString() ?? err.message);
      console.error(err.stderr?.toString() ?? '');
      process.exit(1);
    }
  }
  const mins = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`Done in ${mins} min.`);
}

main();
