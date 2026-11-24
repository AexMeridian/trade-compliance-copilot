# Owner to-do list

Everything that Claude Code and VS Code cannot do on their own: dashboard settings, account actions, paid actions, decisions and reviews that need a person.
Claude keeps this file current. When a new item comes up it is added here, and when you finish one it moves to "Done".

Last updated: 2026-11-23 (after the expert audit fixes and round two of data work)

## Start here: everything you need to do, in order

Verified 2026-11-23 from the live site: the deploy of f760e08 is live and its migrations took effect (the China Section 301 lines now show on lookups); CI and the post-deploy check passed. Wrangler in the terminal has no `CLOUDFLARE_API_TOKEN`, so Claude cannot run remote database checks; you can, or set the token in the terminal.

**A. This week, in this order (about an hour in total)**

1. **Run the "HTS and Schedule B sync" workflow once.** GitHub > Actions > "HTS and Schedule B sync" > Run workflow. First check Settings > Actions > General > Workflow permissions is "Read and write", and that `main` branch protection lets the Actions bot push (the sanctions sync already works this way). The full HTS takes about a week of daily runs; until then `hts` and `schedule_b` stay critical in `/api/pulse/data-status`.
2. **Run "Commerce Control List pull request" once** (Actions tab). It should report no change. Also tick "Allow GitHub Actions to create and approve pull requests" (Settings > Actions > General) so the weekly bots can open pull requests.
3. **Set a hard monthly spend limit** in the Anthropic console (Settings > Limits). The code now stops the calculator if its own spend check fails, but the console limit is the real backstop.
4. **Replace the exposed Anthropic key:** console.anthropic.com > revoke the old keys, create a new one limited to this project, then `npx wrangler secret put ANTHROPIC_API_KEY`.
5. **Create the Census key** at https://api.census.gov/data/key_signup.html, click the activation link in the email (an unactivated key returns an HTML page), then `npx wrangler secret put CENSUS_API_KEY`. After the next 05:30 UTC run, check `census_trade` and `census_acs` in `/api/pulse/data-status`; the effective tariff rate chart on /prices fills over the following days. Check that recent average rates look plausible, because the request shape has not been tested against the real API.
6. **Request the Global Trade Alert key** at https://globaltradealert.org/api-access, then `npx wrangler secret put GTA_API_KEY`. After the 06:00 UTC bulk job runs, open /country/cn and check the "own actions affecting the U.S." panel.
7. **Set two optional secrets:** `npx wrangler secret put SYNC_TOKEN` (any long random string; without it `POST /api/pulse/sync` refuses everyone) and `npx wrangler secret put DEMO_TOKEN` (send it as the `X-Demo-Token` header in demos to skip the per-visitor daily calculator quota). Optional: `OPENALEX_MAILTO` (a contact address for OpenAlex's polite pool).
8. **Turn off Cloudflare Web Analytics auto-injection** (Cloudflare dashboard > Web Analytics, or Speed, for aexterminal.com). The site's security policy blocks its script, so every page logs a console error.
9. **Turn on email alerts.** Cloudflare dashboard > aexmeridian.com > Email > Email Routing: enable it, add and verify CEO@aexmeridian.com. Set `ALERT_EMAIL`, `ALERT_TO`, `ALERT_FROM` as described in `docs/OPERATIONS.md`, uncomment `send_email` in `wrangler.jsonc` and push (or ask Claude). Until then critical findings appear only in `/api/pulse/data-status`.
10. **Add an uptime monitor.** UptimeRobot (free): check `https://aexterminal.com/api/health` every 5 minutes.
11. **Confirm workers.dev is disabled** for this Worker (Cloudflare dashboard > Workers > Settings > Domains and Routes), because rate limits key on the visitor IP header.
12. **Optional build setting:** change the build command to `npm run build:frontend && npx wrangler d1 migrations apply trade-compliance-db --remote` (Workers & Pages > this Worker > Settings > Build) if migrations do not already apply on deploy; if it fails on permissions, edit the build token to allow "D1: Edit". The 0080 to 0085 migrations did take effect on the last deploy, so this may already be working.
13. **After the next 08:00 UTC health run,** check `/api/pulse/data-status`: the criticals should shrink to `hts` and `schedule_b` (until step 1 finishes), plus `openalex` and `pulse_treasury` if their fixes have not taken hold. Tell Claude what remains.

**B. Permissions and licences to ask for (before showing professionals)**

14. **Pew Research Center:** ask in writing what reuse they allow. The site holds Pew series back to 2002 for about 60 countries and offers CSV downloads; Pew's terms allow excerpts.
15. **SIPRI:** read the database terms of use (the military-spending series now credits SIPRI by name) and request permission if commercial or public reuse needs it.
16. **RSF press freedom** (rsf.org): ask what reuse they allow if you want it added to Soft Power.
17. **CBP forced-labor list:** CBP blocks automated downloads (HTTP 403). A CSV is published on its data portal (https://www.cbp.gov/document/stats/withhold-release-orders-findings). Either download it monthly and ask Claude to import it, or ask CBP whether a GitHub runner may fetch it. Claude will not route around the block.
18. **Remittance corridors:** the U.S.-to-country file at remittanceprices.worldbank.org is behind a bot challenge. Download the Excel file in a browser, give it to Claude, and confirm its licence terms. For now country pages show the World Bank's all-sender average.
19. **Traveler allowances:** CBP's pages do not state which countries get the $200, $800 or $1,600 exemptions, or exact alcohol and tobacco quantities. Ask CBP if you want them on /de-minimis.

**C. Professional reviews**

20. **A licensed customs broker** should review: the curated duty rates; the FY2027 informal-entry MPF amounts ($2.77 electronic, $8.30 manual, $12.45 CBP-prepared; taken from the audit, not read from FR 2026-15530) and whether "electronic" is the right default; the de minimis wording; and a spot-check of the China Section 301 data (about 10,000 rows, migrations 0080 to 0085) against the Chapter 99 PDF (hts.usitc.gov, release 2026HTSRev23). Lines with in-effect product exclusions (279) are sent to review on purpose.
21. **A sanctions or export-controls lawyer** should review the screening wording and policy, re-verify the BIS Affiliates Rule suspension date (stated as 2027-01-10; unverified), and re-verify the Part 746 country rows other than Syria.
22. **A Spanish speaker** should check `frontend/src/i18n/content/*.es.ts` (glossary terms and traveler allowances); then re-submit the sitemap in Search Console so the `/es/` pages and their hreflang alternates are picked up.

**D. Decisions for you**

23. **Export "no license required":** with the full control list, an export case with no ECCN match can reach "NLR" with a Part 744 and embargo caveat (never a bare "clear"; the verdict stays "review required"). To be stricter, tell Claude to change `decideCore` in `src/lib/exportLicense.ts`.
24. **Monthly calculator budget:** default $30 (`MONTHLY_BUDGET_USD`). Tell Claude the number you want. Optional: set `REMINDER_DATES` (for example `anthropic key:2027-01-15,cloudflare token:2027-03-01`) so key and token expiries appear in the Monday summary.
25. **Look and navigation:** Soft Power's accent is champagne gold, not teal (to change, edit the two `--color-soft` lines in `frontend/src/theme-midnight.css`); mobile navigation is a bottom tab bar (say if you prefer a scrollable top nav). Run a real Lighthouse mobile pass on the deployed site to confirm the speed work (not measured after the changes).
26. **10-digit statistical suffix:** whether to extend the duty stack to it, which would remove most of the forced review on China lines with exclusions.

**E. Tell Claude when you are ready (these cost money or need a fresh, narrow session)**

27. **Regenerate the four sample cases.** You approved one paid run. Claude waits until this deploy is verified, then runs the seed script against the live site and flags the samples with a migration (wrangler cannot flag them without a token). Under the site's current model every non-USMCA import origin carries a 10 to 12.5% forced-labor Section 301 layer, so no import is verifiably clean until those annex exemptions are sourced; Claude will choose the clean-pass sample after checking the free lookup. Tester findings to confirm fixed: the pen-and-notebook gift set was classified as knives (8211.10); the Russia export sample cited 15 CFR 746.5 (should be 746.8) and lacked AT and an ENC/mass-market step; the Canadian bumper sample stacked a 10% forced-labor layer on a USMCA-qualifying good.
28. **Finish the unfinished features** (stopped to save usage; some partial code is present): CBP CSMS feed on the Wire; "What changed" page with per-day permalinks and RSS (the page and its data file exist, with one day of history so far); IEEPA/"reciprocal" tariff timeline from primary sources (the site never mentions IEEPA); Chapter 99 heading numbers on duty layers; AD/CVD orders in the lookup (the table exists, the data load is not done); NY Fed GSCPI and IMF PortWatch; chart PNG/SVG export; Section 232 metals and autos (the real structure is in HTS note 16 and note 33 of the Chapter 99 PDF; lines that cannot be evaluated stay forced to review).
29. **Smaller improvements:** the Prices page shows "no year-ago reading" for the October 2026 CPI cards (the federal CPI appears to have no October 2025 value); a fallback to the latest month with a year-ago value would read better. Add China's own trade tools (MOFCOM export controls, Unreliable Entity List) from primary documents, PPP GDP, Pew's EU/Russia/Japan/NATO/UN questions, V-Dem, per-capita maps, Tagalog pages. A `fast-xml-parser` low-severity audit finding remains (needs a major version bump). The account is at 5 cron triggers (the Workers Free maximum), so none can be added without removing one.

30. **Dashboard (/dashboard; /today redirects to it), optional follow-ups:** it works with no keys, in four sections (markets and economy; trade and tariffs; power and security; people, politics and the world) plus an "Everything this site tracks" list that shows each source's last update. Its earthquake, storm, volcano, wildfire and flood panel uses USGS and NASA EONET. Not included, because no free source that allows automated access has been added: conflict and war data, and disease outbreaks (the WHO feed address the plan assumed returns 404; ReliefWeb needs a free registered app name, and UCDP and ACLED need access terms or keys). If you register a ReliefWeb app name or find a working outbreak feed, tell Claude to add them. The Census, Global Trade Alert and freight panels appear once those items are finished (see items 5, 6 and 28); the Dashboard lists them under "Not loaded yet" until then. Per-country news in "Your countries" is matched by the country tags on news items, so an occasional off-topic story can appear.

---

The sections below are the detailed reference list (older items; where they conflict with the section above, the section above is current).

## Do now, in this order

| # | What | Where / how | Why it matters |
|---|---|---|---|
| 1 | **Commit and push the audit fixes, then deploy.** | Ask Claude ("commit and push"). Workers Builds deploys on push. | None of the fixes are live until then. |
| 2 | **Apply the database migrations.** Check first which are already applied. | `npx wrangler d1 migrations list trade-compliance-db --remote`, then `npx wrangler d1 migrations apply trade-compliance-db --remote`. Pending from this round (the build applies them automatically): 0031 (Section 232 base rows no longer expire), 0032 (ECCN table verified against the eCFR, Syria note), 0033 (all NATO allies), 0034 (re-tags stored Section 232 import notices and CBP importer rules, from user testing), 0035 (Russia/Belarus cite 15 CFR 746.8). 0027 to 0030 may already be applied (the audit's evidence suggests so). | Without them the NATO chart shows 7 allies, the ECCN table keeps its wrong rows and the 232 duty would disappear on 2028-01-01. |
| 3 | **Set the new secrets.** | `npx wrangler secret put SYNC_TOKEN` (any long random string; without it `POST /api/pulse/sync` refuses everyone) and `npx wrangler secret put DEMO_TOKEN` (send as the `X-Demo-Token` header during demos to skip the per-visitor daily quota). Optional variables: `CLAUDE_IP_DAILY` (default 40 model-calling requests per visitor per day), `CLAUDE_DAILY_CAP` (default 300 total). | Protects the calculator from being used up before a demo. |
| 4 | **Set a hard monthly spend limit in the Anthropic console** (Settings > Limits). | console.anthropic.com | The code now refuses calls if its own spend check fails, but the console limit is the real backstop. |
| 4b | **Sanctions lists now sync from GitHub, not the Worker.** Nothing to do unless the daily "Sanctions list sync" workflow fails (GitHub emails you). | GitHub > Actions > Sanctions list sync | The list files (17-30 MB) need more CPU than the free Worker plan allows, which is why they went stale. The workflow commits only the changes as a migration; the deploy applies it. If pushing to main is ever blocked by branch protection, allow the GitHub Actions bot or switch the workflow to open a pull request. |
| 4c | **Optional free API keys that unlock more data.** Census (api.census.gov/data/key_signup.html) for imports and effective tariff rates by country; Global Trade Alert (globaltradealert.org) for other countries' measures; BLS (bls.gov/developers) for a higher daily limit. Set each with `npx wrangler secret put`. | Cloudflare secrets | Census now refuses keyless requests; GTA never loaded without a key. Ask Claude to wire up Census once the key is set. |
| 5 | **Check the OFAC list refresh after deploy.** | After the next daily run: `https://aexterminal.com/api/pulse/data-status` should show `sdn` and `uk_sanctions` with a recent `lastSuccess`; `/api/pulse/stats` should show about 19,600 SDN and about 6,400 UK entries. If `sdn` still errors, the error text now names the failing step. If it is a CPU or timeout error, either move to the paid Workers plan ($5/month) or run `scripts/fetch-ofac-sdn.ts` and load the output locally. | The sanctions lists have been stale since early October. Verdicts now show a red STALE or NOT LOADED marker until this works. |
| 6 | **Regenerate the four sample cases (paid model calls).** Tell Claude to do it, or: deploy, then `REMOTE=1 BASE_URL=https://aexterminal.com npm run seed:samples` from a UTF-8 shell. Delete the old samples afterwards. Replace the "clean pass" apple with a case that is verifiably clean (its EU Section 301 line would now give 10%). Check the stored text for garbled characters afterwards. | Terminal in this repo | The homepage samples were recorded 2026-09-23 and are labelled as such, but a professional will open them first. |
| 7 | **Turn off Cloudflare Web Analytics auto-injection** (or allow its beacon in `frontend/public/_headers`). | Cloudflare dashboard > Web Analytics (or Speed) for aexterminal.com | The site's security policy blocks the script, so every page logs a console error. |
| 8 | **Turn on email alerts.** | Cloudflare dashboard > aexmeridian.com > Email > Email Routing: enable it, add and verify CEO@aexmeridian.com. Set `ALERT_EMAIL`, `ALERT_TO`, `ALERT_FROM` as described in `docs/OPERATIONS.md`, uncomment `send_email` in `wrangler.jsonc` and push (or ask Claude). | Critical findings (a failed list refresh, for example) are only visible in `/api/pulse/data-status` until then. |
| 9 | **Add an uptime monitor.** | UptimeRobot (free): check `https://aexterminal.com/api/health` every 5 minutes | Catches the Worker being down. |
| 10 | **Replace the exposed API keys.** | Anthropic console: revoke old keys, then `npx wrangler secret put ANTHROPIC_API_KEY` | Keys pasted into chats should be treated as compromised. |
| 11 | **Ask Pew Research Center in writing what reuse they allow.** | Pew permissions contact | The site holds Pew series back to 2002 for about 60 countries plus CSV downloads; Pew's terms allow excerpts. Do this before showing professionals. |
| 12 | **Check SIPRI's terms of use** for the military-spending series (now credited by name). | sipri.org database terms | Commercial or public reuse may need permission; if so, request it or remove the series. |
| 13 | **Allow GitHub Actions to create pull requests.** | GitHub repo > Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" | The weekly Country Chart bot needs it. |
| 14 | **Confirm workers.dev is disabled for this Worker.** | Cloudflare dashboard > Workers > Settings > Domains and Routes | Rate limits key on the visitor IP header. |
| 15 | **Change the build command** to `npm run build:frontend && npx wrangler d1 migrations apply trade-compliance-db --remote`. If it fails on permissions, edit the build token to allow "D1: Edit". | Cloudflare dashboard > Workers & Pages > this Worker > Settings > Build | Future migrations then apply on their own with each deploy. |

## Reviews that need a person (professional judgment)

- **A licensed customs broker** should review: the curated duty rates; the FY2027 informal-entry MPF amounts ($2.77 electronic, $8.30 manual, $12.45 CBP-prepared) against FR 2026-15530 (taken from the audit, not read from the primary notice) and whether "electronic" is the right default to show; the de minimis wording (suspended since 2025-08-29).
- **A sanctions or export-controls lawyer** should review the screening policy wording and re-verify the BIS Affiliates Rule suspension date (stated as 2027-01-10; the date came from the audit and was not verified), and the other Part 746 country rows (only Syria was re-verified).
- Optional: turn on Dependabot auto-merge for patch updates (GitHub repo settings).

## Data work that needs a source or a decision

- **Full Commerce Control List.** The ECCN table now holds about 10 verified entries of roughly 3,000, so the export path says "cannot confirm" rather than "clear". To load the whole list, ask Claude to build a loader from the eCFR versioner API (`curl --compressed "https://www.ecfr.gov/api/versioner/v1/full/<date>/title-15.xml?part=774"`, about 2 MB).
- **Section 232 autos and derivatives.** Chapters 73, 74, 76, 83, 84, 85, 87 and headings 8703, 8704, 8708 always force review until the annex line lists and the country rates (EU, Japan, Korea, UK; USMCA truck non-U.S. content rule) are sourced from primary documents. Federal Register pages block automated fetches, so someone needs to read them or supply the text. A future fiscal-year MPF notice also needs a new row in `src/lib/customsFees.ts`.
- **China's Section 301 Lists 1 to 4A** and the pending Section 301 excess-capacity action: the panel only discloses that they are not included. Hand-verify the Federal Register annexes and ask Claude to add them.
- **China's own trade tools** (MOFCOM export controls, Unreliable Entity List): the Hard Power page discloses that only U.S. tools are shown. Provide primary documents if you want them added.
- **PPP GDP** (World Bank `NY.GDP.MKTP.PP.CD`): say if you want it added beside market-rate GDP.
- **Soft Power additions that need a licence review or more data:** V-Dem or Freedom House (licence), UN voting percentage agreement (needs the raw roll-call data), Pew's EU, Russia, Japan, NATO and UN questions and unfavorable shares (hand entry from Pew reports), per-capita maps (new series), RSF press freedom (ask RSF about reuse). Verify the UN peacekeeping contributor files (peacekeeping.un.org) and UNESCO World Heritage reuse terms (both returned HTTP 403 to automated checks), then update the "What we looked for and left out" list.
- **HTS refresh on the free plan.** The Harmonized Tariff Schedule load makes 96 requests against a 50-request limit and cannot finish on the free Worker plan. Options: a GitHub Action that loads it with `wrangler d1 execute` (Claude can build this), or the paid plan. Also pending: D1 write accounting by actual writes (not rows), and a privacy statement for case links (a content and legal decision: anyone with a case URL can read it; descriptions and names are stored 30 days).

## API keys and secrets

Keys are never put in the repo or pasted into chat. Set each one in the terminal with `npx wrangler secret put NAME` (it prompts for the value), or in Cloudflare dashboard > Workers & Pages > this Worker > Settings > Variables and Secrets.

| Name | Needed? | Where to get it | What it powers |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Required (already set; replace it, see do-now item 10) | console.anthropic.com > API keys. Use a new key limited to this project and set a spend limit there. | The four calculator steps. The only thing that spends credit. |
| `SYNC_TOKEN` | Needed to use `POST /api/pulse/sync` by hand | Any long random string you make up | Manual data refresh (cron already refreshes daily) |
| `DEMO_TOKEN` | Optional, for demos | Any long random string you make up | Skips the per-visitor daily calculator quota |
| Cloudflare API token (build) | Only if the build command change (item 15) fails on permissions | Cloudflare dashboard > My Profile > API Tokens: edit the existing Workers Builds token to include "D1: Edit". | Applying migrations on deploy. |
| `COMTRADE_API_KEY` | Optional, only if you want trade partners on Soft Power. Not built yet. | comtradedeveloper.un.org: free account, subscribe to the free API product, copy the primary key. | Bilateral trade ("top trading partners") |
| `IATI_API_KEY` | Optional, only for aid by recipient. Not built yet. | iatiregistry.org / the IATI Datastore: free account and key. | Who gives aid to whom |

Nothing else needs a key today: Treasury, Federal Register, eCFR, World Bank, UNHCR, UNDP, OpenAlex and the other feeds are keyless.

## Decisions

- Monthly calculator budget: default is $30 (`MONTHLY_BUDGET_USD` in the Worker variables). Tell Claude the number you want.
- Key and token expiry reminders: set `REMINDER_DATES` to e.g. `anthropic key:2027-01-15,cloudflare token:2027-03-01` to have them listed in the Monday summary.
- Look: Soft Power's accent is now champagne gold instead of teal (to match the navy and champagne theme). If you prefer teal back, change only the two `--color-soft` lines in `frontend/src/theme-midnight.css`.
- Mobile navigation: a bottom tab bar (Wire, Hard Power, Soft Power, Calculator, About). Say if you would rather have a scrollable top nav.
- Run a real Lighthouse mobile pass on the deployed site to confirm the performance work (it was not measured after the changes).

## Recurring (when an email or reminder arrives)

- **Pending law notices.** When an email says notices are pending, read each one (the link is in the email). If it changes a rate, scope or date the calculator uses, tell Claude; it edits the curated rows. If not, dismiss it (command in `docs/OPERATIONS.md`). Nine were pending in the local copy, including new Section 232 actions on robotics and wind turbines.
- **Country Chart pull request** (weekly bot, only when the official chart changed): read the listed changes, merge if right.
- **Dated chores** (listed in the Monday summary): October change to the customs fee limits, January HTS revision, July USMCA anniversary, end of the fee schedule on 2027-09-30, `security.txt` expiry on 2027-10-09.
- **Top up Anthropic credit** when the calculator reports it is paused. Only the calculator spends credit. The accuracy scripts need `--confirm-cost` and ask first.

## Done

- 2026-11-11: self-monitoring system committed and pushed (0e49cd3). Hard Power overview page lengthened with trade, sanctions, money and military sections.
- 2026-11-21: code fixes for the expert audit (scheduler starvation, health alerts, list-age gating, ECCN table, de minimis, "Clear" wording, Section 232 review, Hard Power and Soft Power labelling, mobile nav, focus ring, fonts and more). Written, tested (typecheck, unit tests and frontend build pass), not yet committed or deployed.

## Update 2026-11-23 (verification and round two)

Changes to the list above:
- Item 2 (migrations): the live counts show 0031 to 0053 applied (10 ECCN rows, lists synced). This round adds migrations 0060 (Census tables), 0070 to 0072 (full control list and country groups), 0080 to 0085 (China Section 301), 0090 (write metering) and 0110 (AD/CVD table). They apply on deploy; confirm with `npx wrangler d1 migrations list trade-compliance-db --remote`.
- Wrangler in this environment has no `CLOUDFLARE_API_TOKEN`, so remote checks (migration list, deployments, row counts, `wrangler tail` during a cold country page) must be run by you, or set the token in the terminal.

New items:
1. **Create the Census key** (https://api.census.gov/data/key_signup.html, click the activation link), then `npx wrangler secret put CENSUS_API_KEY`. After the 05:30 UTC run check `census_trade` and `census_acs` in `/api/pulse/data-status`; check that recent average rates look plausible (the request shape is untested without a key).
2. **Request the Global Trade Alert key** (https://globaltradealert.org/api-access), then `npx wrangler secret put GTA_API_KEY`.
3. **Run the "HTS and Schedule B sync" workflow once** (GitHub > Actions > Run workflow), and check that Actions has "Read and write" permissions and that branch protection lets the bot push. The first full load takes about a week of daily runs.
4. **Run "Commerce Control List pull request" once** from the Actions tab (should report no change).
5. **Optional:** `npx wrangler secret put OPENALEX_MAILTO` (contact address for OpenAlex); check `openalex` and `pulse_treasury` in data-status the day after deploy.
6. **Decision:** with the full control list, an export case with no ECCN match can reach "NLR" with a Part 744 and embargo caveat (never a bare "clear"; the verdict stays "review required"). To be stricter, change `decideCore` in `src/lib/exportLicense.ts`.
7. **Spot-check the China Section 301 data** (about 10,000 rows, migrations 0080 to 0085) against the Chapter 99 PDF (hts.usitc.gov, release 2026HTSRev23); lines with in-effect product exclusions (279) are sent to review on purpose. Decide whether to add the 10-digit statistical suffix to remove most of that review. Re-sync whenever USITC publishes a new HTS revision.
8. **Spanish review:** have a native or professional reader check `frontend/src/i18n/content/*.es.ts`; re-submit the sitemap in Search Console.
9. **CBP forced-labor list:** CBP blocks automated downloads; a CSV is published on its data portal. Either download it monthly and ask Claude to import it, or ask CBP whether a GitHub runner may fetch it. Claude will not route around the block.
10. **Remittance corridors:** the U.S.-to-country file at remittanceprices.worldbank.org is behind a bot challenge. Download the Excel file in a browser and provide it, and confirm its licence terms. The page now shows the World Bank average for sending money to the country from all tracked senders.
11. **Traveler allowances:** CBP's pages do not state which countries get the $200, $800 and $1,600 exemptions or exact alcohol and tobacco quantities; ask CBP if you want them on /de-minimis.
12. **Sample cases (you approved the paid run):** run after this is merged and deployed, so it is paid once. The seed script flags samples with a remote wrangler write (needs a token), so Claude will flag them with a migration instead. Under the site's current model every non-USMCA import origin carries a 10 to 12.5% forced-labor Section 301 layer, so no import is verifiably clean until those annex exemptions are sourced; the clean-pass sample should be chosen after that.
13. **Unfinished, needs a finish-and-verify pass (cheapest to do in a fresh session):** CBP CSMS feed on the Wire; "What changed" page with RSS from list snapshots; IEEPA/reciprocal-tariff timeline from primary sources; Chapter 99 heading numbers on duty layers; AD/CVD orders in the lookup (table exists, data load not done); NY Fed GSCPI and IMF PortWatch; chart PNG/SVG export; Section 232 metals and autos (the real structure is in HTS note 16 and note 33 of the Chapter 99 PDF; blocked lines stay forced to review).
14. **Cron limit:** the account is at 5 cron triggers, the Workers Free maximum; none can be added without removing one.
