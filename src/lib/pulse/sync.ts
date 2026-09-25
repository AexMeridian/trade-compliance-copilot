// Incremental sync for Trade Policy Pulse -- shared verbatim by the daily
// cron job (src/scheduled.ts) and the manual POST /api/pulse/sync route
// (src/routes/pulse.ts). Unlike the other refresh jobs (hts.ts, sdn.ts, ...)
// this is NOT a full delete+reinsert: it only asks the Federal Register API
// for documents published since the last successful sync, then upserts by
// document_number, so a repeat run of an overlapping window just re-affirms
// rows rather than duplicating or losing anything.
import type { Env } from '../../types/env.js';
import { fetchDocumentsForTerm, KEYWORD_TERMS, type FederalRegisterDocument } from './federalRegister.js';
import { tagDocument, resolveAgencySlugs } from './tag.js';
import { extractCountries } from './country.js';
import { sqlString, sqlJson, buildInsertStatements } from '../refresh/sql.js';
import type { RefreshResult } from '../refresh/types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export async function runPulseSync(env: Env): Promise<RefreshResult> {
  const state = await env.DB.prepare('SELECT last_synced_date FROM pulse_sync_state WHERE id = 1').first<{
    last_synced_date: string | null;
  }>();
  const sinceDate = state?.last_synced_date ?? monthsAgo(24);

  // Each term is an independent I/O-bound request -- fetching them
  // concurrently (measured: ~3.4s sequential locally, ~5.4s in production
  // for 10 terms) cuts wall-clock to roughly the slowest single request
  // instead of the sum, which matters both for the cron's CPU-time budget
  // and for how long "Refresh now" leaves someone waiting. 13 concurrent
  // requests to one external API is a standard, low-risk Workers pattern.
  const termResults = await Promise.all(KEYWORD_TERMS.map((term) => fetchDocumentsForTerm(term, sinceDate)));

  const byDocNumber = new Map<string, FederalRegisterDocument>();
  const truncatedTerms: string[] = [];
  KEYWORD_TERMS.forEach((term, i) => {
    const { docs, truncated } = termResults[i];
    for (const doc of docs) byDocNumber.set(doc.document_number, doc);
    if (truncated) truncatedTerms.push(term);
  });
  if (truncatedTerms.length > 0) {
    console.warn(
      `Pulse sync hit the pagination cap for: ${truncatedTerms.join(', ')} -- some historical documents for ${sinceDate} onward may be missing from this run.`
    );
  }

  const now = new Date().toISOString();
  let maxPublicationDate = sinceDate;
  const rows: string[] = [];

  for (const doc of byDocNumber.values()) {
    const agencySlugs = resolveAgencySlugs(doc.agencies.map((a) => a.name));
    const tag = tagDocument({ title: doc.title, abstract: doc.abstract, agencySlugs });
    const agencyNames = doc.agencies.map((a) => a.name).join(', ');
    const countries = extractCountries(`${doc.title} ${doc.abstract ?? ''}`);
    if (doc.publication_date > maxPublicationDate) maxPublicationDate = doc.publication_date;

    rows.push(
      `(${sqlString(doc.document_number)}, ${sqlString(doc.title)}, ${sqlString(doc.abstract)}, ` +
        `${sqlString(agencyNames)}, ${sqlString(doc.type)}, ${sqlString(doc.publication_date)}, ` +
        `${sqlString(tag)}, ${sqlString(doc.html_url)}, ${sqlString(now)}, ` +
        `${sqlString(doc.effective_on)}, ${sqlString(doc.comments_close_on)}, ${sqlString(doc.citation)}, ${sqlJson(countries)})`
    );
  }

  // A future run should never re-fetch a date already fully covered -- move
  // the checkpoint to one day past the newest publication_date seen (or
  // leave it unchanged if nothing new came back), never past "today", since
  // the Federal Register can still add same-day documents after this run.
  const today = now.slice(0, 10);
  const nextCheckpoint = rows.length > 0 ? new Date(Date.parse(maxPublicationDate) + MS_PER_DAY).toISOString().slice(0, 10) : sinceDate;
  const checkpoint = nextCheckpoint > today ? today : nextCheckpoint;

  const statements = buildInsertStatements(
    `INSERT INTO trade_policy_actions
       (document_number, title, abstract, agency, doc_type, publication_date, tag, html_url, fetched_at,
        effective_on, comments_close_on, citation, countries)
     VALUES`,
    rows,
    150,
    `ON CONFLICT(document_number) DO UPDATE SET
       title = excluded.title, abstract = excluded.abstract, agency = excluded.agency,
       doc_type = excluded.doc_type, publication_date = excluded.publication_date,
       tag = excluded.tag, html_url = excluded.html_url, fetched_at = excluded.fetched_at,
       effective_on = excluded.effective_on, comments_close_on = excluded.comments_close_on,
       citation = excluded.citation, countries = excluded.countries`
  );

  await env.DB.batch([
    ...statements.map((s) => env.DB.prepare(s)),
    env.DB.prepare(
      `INSERT INTO pulse_sync_state (id, last_synced_date, last_synced_at) VALUES (1, ?1, ?2)
       ON CONFLICT(id) DO UPDATE SET last_synced_date = excluded.last_synced_date, last_synced_at = excluded.last_synced_at`
    ).bind(checkpoint, now),
  ]);

  return { source: 'pulse', rows: rows.length, truncatedTerms: truncatedTerms.length > 0 ? truncatedTerms : undefined };
}
