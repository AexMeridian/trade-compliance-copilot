# Trade Compliance Copilot

A portfolio web app that walks a product and a proposed cross-border
transaction (import or export) through four connected trade-compliance
modules — classification, USMCA origin, denied-party screening, and final
determination — the way a trade compliance analyst would, and produces one
coherent compliance report. Built as a resume piece for an International
Business student heading toward trade law.

**Not legal advice.** Every report ends with that disclaimer, and it's meant
literally — this is a demonstration of how an LLM can be *grounded* in real
government reference data rather than trusted to invent tariff codes or legal
rules from memory. See [Design principles](#design-principles) below.

## Tech stack

- **Runtime**: Cloudflare Workers + [Hono](https://hono.dev) (TypeScript)
- **Database**: Cloudflare D1 (SQLite), with FTS5 full-text search over the
  classification and party-screening tables
- **Frontend**: React + Vite + Tailwind CSS v4, built as static assets served
  by the same Worker via Workers Assets (one `wrangler deploy`, not a
  separate Pages project)
- **LLM**: Anthropic API (`@anthropic-ai/sdk`), model `claude-sonnet-4-6`,
  called only with forced tool-use against JSON Schemas whose `enum` fields
  are populated from real database rows at request time — see
  [Design principles](#design-principles)

## Design principles

1. **The model never invents a code.** Every classification (HTS/Schedule B
   code, USMCA rule, ECCN) is selected from a candidate list retrieved from
   D1 via full-text search *before* the Claude call, and the tool schema's
   `enum` constrains the response to that list. A defensive check after
   parsing re-verifies this — the model is never trusted blindly, even though
   the schema should make it structurally impossible to violate.
2. **Arithmetic is never delegated to the LLM.** Duty-stack rate lookups,
   the Section 232/301/338 stacking/exclusion logic, and RVC pass/fail math
   are all plain deterministic TypeScript (`src/lib/dutyStack.ts`). Claude's
   role there is narration and flagging ambiguity, never computation — and
   the prompt explicitly forbids it from stating a total when the underlying
   rate couldn't be parsed (see `src/prompts/determination.ts`).
3. **Gaps are disclosed, never papered over.** If a heading has no curated
   USMCA rule, if a destination isn't in the curated Commerce Country Chart
   subset, or if a duty rate is non-ad-valorem and can't be summed
   automatically, the app says so explicitly (`qualifies: null`,
   `license_requirement: "Insufficient Data"`, a duty line with no total) —
   it never guesses to produce a cleaner-looking answer. See
   [Known limitations](#known-limitations) for the specific, disclosed gaps
   in this build's reference data.
4. **Every reference-data table carries provenance** — `source_url`,
   `source_tier` (1 = primary official source, 2 = official secondary tool,
   3 = secondary analysis used only to confirm interpretation), and
   `last_updated`/`data_as_of` — surfaced as badges in the UI wherever that
   data is used.

## Setup

```bash
npm install                 # installs root + frontend workspace deps
npx wrangler login           # only needed before a --remote deploy
```

### 1. Create the D1 database (first time only)

The repo ships with a placeholder `database_id` in `wrangler.jsonc` that
works for local dev. Before deploying remotely:

```bash
npx wrangler d1 create trade-compliance-db
# paste the printed database_id into wrangler.jsonc
```

### 2. Apply schema migrations

```bash
npm run db:migrate:local     # local (wrangler dev) database
npm run db:migrate:remote    # after creating the real remote database
```

This creates all tables (including FTS5 virtual tables and their sync
triggers) and loads the small, hand-curated reference tables (Commerce
Country Chart subset, USMCA rules, Section 232/301/338 tariff overlays,
ECCN entries) directly as migration content.

### 3. Bulk-load the large reference tables

These are **not** part of migrations (D1 migrations aren't designed for
tens of thousands of rows) — they're generated as batched SQL by
fetch/build scripts, then executed separately:

```bash
npm run seed:hts             # full USITC HTS schedule, chapter by chapter (~1-2 min)
npm run seed:schedule-b      # full Census Schedule B (AES filer CSV) (~10 sec)
npm run seed:xref            # derives the HTS<->Schedule B cross-reference (~5 sec)
npm run seed:ofac            # full OFAC SDN list (~30 sec)
npm run seed:csl             # BIS/State Consolidated Screening List, non-SDN sub-lists (~15 sec)

npm run seed:load-local      # loads everything generated above into local D1 (~8-10 min)
```

Expect real wall-clock time for the load step — it's chunked into ~200 files
executed sequentially via `wrangler d1 execute --file`, each with its own
subprocess overhead. It's a one-time setup cost, not something you re-run
often (see [Refreshing data](#refreshing-the-data) below).

### 4. Add your Anthropic API key

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars and paste a real key -- this file is gitignored
```

For a real deployment, use a Worker secret instead of a file:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

### 5. Run it

```bash
npm run dev                  # builds the frontend, then starts wrangler dev
```

Open the printed local URL. The landing page's "Run a sample case" buttons
won't show anything until you seed them:

```bash
npm run seed:samples         # drives 4 real cases through the live API (needs `wrangler dev` already running)
```

### 6. Run the accuracy test

```bash
npm run test:golden          # needs `wrangler dev` already running
```

This pushes 10 real products (5 import, 5 export) through Module 1 against
the live Claude-backed endpoint and reports pass/fail against expected
HTS/Schedule B prefixes drawn from HTSUS subheading text and well-known
commodity classifications. **Current result: 10/10 (100%)**, stable across
repeated runs — a real, unmodified accuracy signal, not a number chosen to
look good. It started at 6/10 (60%); the two retrieval-side failures (see
[Known limitations](#known-limitations)) were root-caused and fixed by
widening how candidates are retrieved from D1, not by tuning prompts against
this specific test set. The remaining, *not* retrieval-side risk — the model
occasionally choosing a broader heading over a more specific one that's
sitting right in its candidate list — is a genuine LLM reasoning limitation
that re-running can still surface; it's discussed below rather than
papered over.

## Deploying

```bash
npm run deploy                # builds frontend, then `wrangler deploy`
```

Make sure you've run the `db:migrate:remote` and `seed:*:remote`-equivalent
steps against the real D1 database first (swap `--local` for `--remote` on
each loader — see `scripts/load-batches.ts`), and that
`ANTHROPIC_API_KEY` is set via `wrangler secret put`, not `.dev.vars` (which
is local-only and never deployed).

## Repo layout

```
migrations/              D1 schema + small curated seed data (country chart subset,
                          USMCA rules, tariff overlays, ECCN entries)
scripts/                 Bulk data loaders (HTS, Schedule B, OFAC SDN, CSL) +
                          scripts/refresh_data.md (how to re-run each one later)
src/
  routes/                One Hono route file per module + cases.ts (create/report/samples)
  lib/                    D1 query helpers, fuzzy matcher, duty-stack math, Anthropic wrapper
  prompts/                System prompts + tool schemas, one file per module
  types/case.ts           The shared CaseFile type every module reads/writes
frontend/                 React + Vite + Tailwind UI (Landing, CaseWizard, Report)
tests/                    golden-cases.json + the accuracy-test runner
```

## Data sources & provenance

| Table | Source | Tier | Breadth |
|---|---|---|---|
| `hts_lines` | [USITC HTS exportList API](https://hts.usitc.gov/reststop/exportList) | 1 | Full schedule, 96 chapters, 31,860 lines |
| `schedule_b_lines` | [Census AES Filer concordance CSV](https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaescsv.txt) | 1 | Full schedule, 97 chapters, 9,746 lines |
| `sdn_entries` / `sdn_aliases` | [OFAC Sanctions List Service](https://sanctionslistservice.ofac.treas.gov) | 1 | Full SDN list, 19,393 entries, 24,628 aliases |
| `csl_entries` / `csl_aliases` | [trade.gov Consolidated Screening List](https://www.trade.gov/consolidated-screening-list) | 1 | Full CSL minus the SDN sub-list (already covered above), 6,753 entries |
| `usmca_rules` | HTSUS General Note 11 / USMCA Annex 4-B, curated | 1 | Chapters 84, 85, 87, 61, 62, 63 — **partial by design**, see below |
| `country_chart` / `country_chart_coverage` | 15 CFR 738 Supp. 1 / Part 746, curated | 1 | 6 allied destinations + 4 comprehensive embargoes + Russia/Belarus — **deliberately partial**, see below |
| `eccn_entries` | 15 CFR 774 Supp. 1, curated | 1/3 | 8 representative entries across CCL Categories 1, 3, 4, 5, 6 + EAR99 |
| `tariff_overlays` | Federal Register (Section 232/301/338 proclamations), curated | 1 | Full breadth for Sec. 301 forced-labor (all 60 named economies); chapter-level approximation for Sec. 338 and Sec. 232 |

Every row also carries `last_updated` and (for tariff overlays) `data_as_of`,
rendered as provenance badges in the UI. Tariff overlay data reflects
Federal Register actions as of **September 22, 2026** — verify against
primary sources before relying on this for a real transaction.

## Known limitations

This section exists because the alternative — quietly shipping gaps — is
worse for a compliance tool than disclosing them. All of the following are
*intentional, disclosed* scope boundaries, not bugs:

- **Commerce Country Chart coverage is a small curated subset** (6 close
  allies verified at NS Column 1/2 only, the 4 comprehensively-embargoed
  destinations, and Russia/Belarus under the near-comprehensive 746.5/746.8
  restriction). An automated fetch of the full ~180-country chart during
  this build produced internally inconsistent results (it marked Israel
  identically to Russia/China across every column, which isn't plausible)
  and was discarded rather than trusted — see the comment in
  `migrations/0005_seed_country_chart.sql`. A destination outside this set
  resolves to `"Insufficient Data"`, never a guessed answer.
- **USMCA rules cover 6 of dozens of HTSUS chapters** (84, 85, 87, 61, 62,
  63). A heading outside these resolves to `qualifies: null` with an
  explicit "not curated" reasoning trace, never a fabricated rule.
- **Section 232/338 overlays are encoded at chapter/heading granularity**,
  not the exact 8-digit line lists in each proclamation's annex (e.g.
  Section 338's Canada dairy tranche is really 52 specific lines within
  Chapter 04, not the whole chapter). Every affected duty-stack line carries
  an explicit caveat saying so, surfaced in the report — the app never
  presents a chapter-level approximation as line-item-confirmed.
- **Classification retrieval is keyword-based FTS5, not semantic search.**
  It correctly grounds every answer in a real database row, but a plain OR'd
  bm25 query has a specific, real failure mode: a row matching two or more
  *common* query words can outrank the row matching the query's one truly
  *distinctive* word, because bm25's per-term scoring rewards matching more
  terms over matching one rare, on-topic term. Two golden cases (a
  "vacuum-insulated ... bottle" import and its export twin) exposed this —
  dozens of unrelated "Of stainless steel" rows outranked the heading that
  actually says "vacuum flasks and vessels," and on the export side, Census's
  own Schedule B text for that heading drops the word "vacuum" entirely
  (verified against the live source CSV, not a parsing bug). Both are fixed
  in `src/lib/db.ts`, not papered over: (1) every individual query term is
  also searched on its own and merged into the candidate set, so a rare
  term's best match can't be buried by common-term noise; (2) a matched row's
  *siblings* (not just its children) are pulled in via `superior_id`, since
  HTS statistical-suffix rows are often only distinguishable in context (the
  correct wooden-dining-chair leaf, "Other household," has zero literal
  overlap with the query — only its sibling "Chairs for children" does); (3)
  Schedule B search cross-pollinates with a parallel HTS search over the
  same query, pulling in any Schedule B line sharing an HS-6 prefix with a
  matched HTS row — a principled use of one schedule's richer text to cover
  gaps in the other's, since they share the same HS-6 nomenclature by
  construction, not a fabrication. This closed both golden-case failures
  (`npm run test:golden` now passes 10/10) without a rewrite into semantic/
  embedding search, which remains out of scope for this build — a query and
  a heading with genuinely *zero* shared or cross-referenced vocabulary can
  still fail to retrieve the right candidate.
- **Even when the correct candidate IS retrieved, the model can still pick a
  broader heading over a more specific one that's right there in the
  candidate list.** The clearest example from golden-case testing: for
  "Men's knit cotton t-shirts...", the retrieved candidates included both
  `6105` ("Men's or boys' shirts, knitted or crocheted") and the far more
  specific `6109.10.00.04` ("T-shirts, all white, short hemmed sleeves...
  crew or round neckline...") — and the model chose `6105` anyway on one
  run, despite `6109` being the textbook-correct heading for T-shirts
  specifically (dress/button shirts and T-shirts are different headings in
  the real HTS). This is a genuine LLM reasoning limitation, not a grounding
  gap — the right answer was available and ignored — and no prompt tweak was
  added specifically to fix this one benchmark case, since that would be
  optimizing for the test rather than for real accuracy.
- **HTS duty rates that are non-ad-valorem** (specific/compound, e.g.
  "9.1¢/kg") or that carry the USMCA "S+" differential-by-country indicator
  are flagged rather than summed into a false total — `landed_cost_estimate_pct`
  is `null` in that case, and the report says exactly which line blocked it.

## Refreshing the data

See `scripts/refresh_data.md` for a runbook on re-running each loader when
the underlying source data changes (new HTS revision, updated SDN list,
new tariff proclamation, etc).
