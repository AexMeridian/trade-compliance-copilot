// Rebuilds the ancestor-text search index (hts_path_search) from hts_lines.
// Run after any manual HTS reload (load-batches.ts does this automatically):
//   npm run seed:path-index            # local
//   npm run seed:path-index -- --remote
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HTS_PATH_INDEX_BUILD_SQL, HTS_PATH_INDEX_CLEAR_SQL } from '../src/lib/refresh/htsPathIndex.js';

const DB_NAME = 'trade-compliance-db';

export function rebuildHtsPathIndex(mode: '--local' | '--remote') {
  // --file, not --command: with a shell (needed on Windows) a multi-word SQL
  // argument is split on spaces, the same reason load-batches.ts uses files.
  const dir = mkdtempSync(join(tmpdir(), 'hts-path-index-'));
  const file = join(dir, 'rebuild.sql');
  try {
    writeFileSync(file, `${HTS_PATH_INDEX_CLEAR_SQL};\n${HTS_PATH_INDEX_BUILD_SQL};\n`);
    execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, mode, `--file=${file}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    console.log(`Rebuilt hts_path_search (${mode}).`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith('rebuild-hts-path-index.ts')) {
  rebuildHtsPathIndex(process.argv.includes('--remote') ? '--remote' : '--local');
}
