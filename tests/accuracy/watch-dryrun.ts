// Dry run of the change watcher against the local database: which stored notices would raise alerts today. Read-only.
import { openLocalDb } from './d1shim.js';
import { findNewAlerts, type WatchedAction } from '../../src/lib/curatedWatch.js';

const db = openLocalDb();
if (!db) throw new Error('no local database');
const n = (db.prepare('SELECT COUNT(*) AS n, MAX(publication_date) AS newest FROM trade_policy_actions').get() as { n: number; newest: string });
console.log(`stored notices: ${n.n}, newest ${n.newest}`);
const actions = db.prepare('SELECT document_number, title, abstract, agency, doc_type, publication_date, effective_on, html_url FROM trade_policy_actions WHERE publication_date > ? ORDER BY publication_date DESC').all('2026-09-22') as unknown as WatchedAction[];
const alerts = findNewAlerts(actions, { sec232: '2026-09-22', sec301: '2026-09-22', sec338: '2026-09-22', usmca: '2026-09-22', export_controls: '2026-09-22', customs_fees: '2026-09-22' }, new Set());
console.log(`${actions.length} notices since 2026-09-22 -> ${alerts.length} alerts`);
for (const a of alerts) console.log(`  ${a.program.padEnd(15)} ${a.publication_date} ${a.title.slice(0, 100)}`);
