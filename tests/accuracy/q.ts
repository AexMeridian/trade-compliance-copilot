import { openLocalDb } from './d1shim.js';
const db = openLocalDb()!;
for (const r of db.prepare(process.argv[2]).all() as Record<string, unknown>[]) console.log(JSON.stringify(r));
