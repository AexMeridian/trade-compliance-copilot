# Refreshing reference data

This app's bulk reference tables (HTS, Schedule B, OFAC SDN, BIS/State CSL)
are loaded from live government sources via the scripts in this directory,
not hand-curated. They will go stale — here's how to refresh each one.

## HTS (`npm run seed:hts`)

Source: `https://hts.usitc.gov/reststop/exportList`, chapter by chapter.
USITC publishes a new HTS revision several times a year. Re-run:

```bash
npm run seed:hts          # regenerates scripts/seed-sql/hts/*.sql
```

Before reloading, clear the existing table (the loader uses explicit
sequential IDs, so re-running `seed:load-local`/`remote` without clearing
first will hit primary-key conflicts):

```bash
npx wrangler d1 execute trade-compliance-db --local --command "DELETE FROM hts_lines;"
npm run seed:load-local -- --only=hts
```

(`--remote` for the deployed database.) The FTS5 sync triggers on
`hts_lines` will repopulate `hts_search` automatically as part of the
DELETE + re-INSERT.

## Schedule B (`npm run seed:schedule-b`)

Source: Census's AES Filer concordance CSV
(`census.gov/foreign-trade/aes/documentlibrary/concordance/expaescsv.txt`).
Census has no REST API for Schedule B, but this file turned out to be a
genuine full-breadth data file (not just a curated subset) — check the
`Last-Modified` header the script prints; Census updates this periodically
(the build used the July 2026 edition). Same clear-then-reload pattern:

```bash
npx wrangler d1 execute trade-compliance-db --local --command "DELETE FROM schedule_b_lines;"
npm run seed:schedule-b
npm run seed:load-local -- --only=schedule_b
```

**Re-run `npm run seed:xref` after refreshing either HTS or Schedule B** —
the cross-reference table is derived from both and will be stale/incomplete
otherwise. It reads the already-generated `scripts/seed-sql/hts/*.sql` and
`scripts/seed-sql/schedule_b/*.sql` files directly (not a live D1 query), so
run it after both fetch scripts, before loading:

```bash
npm run seed:xref
npx wrangler d1 execute trade-compliance-db --local --command "DELETE FROM hts_schedule_b_xref;"
npm run seed:load-local -- --only=xref
```

## OFAC SDN (`npm run seed:ofac`)

Source: `sanctionslistservice.ofac.treas.gov`, the official Sanctions List
Service (302-redirects to a signed S3 URL; the fetch script follows this
automatically). OFAC updates the SDN list frequently — for anything beyond
a portfolio demo, this should be refreshed at least daily.

```bash
npx wrangler d1 execute trade-compliance-db --local --command "DELETE FROM sdn_aliases; DELETE FROM sdn_entries;"
npm run seed:ofac
npm run seed:load-local -- --only=sdn
```

(Delete aliases before entries — `sdn_aliases.sdn_id` has a foreign key on
`sdn_entries`.)

## BIS/State Consolidated Screening List (`npm run seed:csl`)

Source: `data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv`.
This file also republishes OFAC's SDN list under its own source tag — the
loader deliberately excludes those rows (see the `EXCLUDED_SOURCES` set in
`fetch-csl.ts`) since the dedicated SDN loader above already covers them
with richer structured fields.

```bash
npx wrangler d1 execute trade-compliance-db --local --command "DELETE FROM csl_aliases; DELETE FROM csl_entries;"
npm run seed:csl
npm run seed:load-local -- --only=csl
```

## Curated tables (migrations, not scripts)

`usmca_rules`, `country_chart` / `country_chart_coverage`, `eccn_entries`,
and `tariff_overlays` are hand-curated content living directly in
`migrations/0005`–`0009` — there's no automated refresh for these. To
extend them (e.g. add another USMCA chapter, another country to the
Commerce Country Chart, or update a tariff rate after a new proclamation):

1. Verify the new data against a primary source (Federal Register, eCFR,
   CBP fact sheet) — never copy from a secondary summary for the rate/code/
   rule itself.
2. Add a new migration file (`0010_...sql`, sequential, never renumber an
   already-applied one) rather than editing an applied migration in place.
3. Every new row needs `source_url`, `source_tier`, `last_updated` (and
   `data_as_of` for tariff overlays) filled in honestly.

If you can't verify a specific data point against a primary source, leave
it uncurated rather than guessing — the app is explicitly designed to
surface "not curated" as an honest answer (see the README's
"Known limitations" section) rather than fabricate one.

## One-time full local reset

```bash
npx wrangler d1 execute trade-compliance-db --local --command "DELETE FROM hts_schedule_b_xref; DELETE FROM hts_lines; DELETE FROM schedule_b_lines; DELETE FROM sdn_aliases; DELETE FROM sdn_entries; DELETE FROM csl_aliases; DELETE FROM csl_entries;"
npm run seed:hts && npm run seed:schedule-b && npm run seed:xref && npm run seed:ofac && npm run seed:csl
npm run seed:load-local
```
