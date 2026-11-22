# User testing, November 2026

On 2026-11-22, eleven simulated visitors browsed the live site (https://aexterminal.com) in a real browser, on desktop and phone. Six were professionals and five were ordinary people. Each tried the tasks that person would really come to do and reported what data they wished the site had and what else would bring them back. They were read-only and did not start new calculator cases.

This follows the expert audit in `docs/AUDIT-2026-11.md`. That audit asked "is it correct?"; this round asks "is it useful, and to whom?". Items already in the audit are not repeated unless a visitor hit them in a new way. Treat findings as "verify, then fix": they are simulated users, not real ones.

One side effect: the Etsy-seller tester clicked "Start an import case", which created one empty case record (`/case/12af4d21-...`) with no model call. It can be deleted.

## The visitors

| Persona | Who | Would come back? | The one change that would flip their answer |
|---|---|---|---|
| Customs broker (Dana) | Licensed broker, Laredo, 15 years | Weekly, for the Federal Register feed; would not cite a duty stack or send clients | CBP CSMS messages and the Chapter 99 heading (9903.xx) on every duty layer |
| Export-controls manager (Raj) | Electronics manufacturer, 60 countries | For the BIS/OFAC feed; not in the team's SOP | Same-day, entry-level designation feed (SDN, Entity List, EU, UK) with citations and an honest as-of date |
| Trade economist (Dr. Ortiz) | Think tank, briefs Congress | For the action feed and Methodology; not for numbers | Downloadable monthly effective tariff rate (duties ÷ imports), total and by partner |
| Small importer (Marcus) | 12 staff, cookware from China and Vietnam | Not yet; would tell his broker it's a news feed | Free lookup by HTS code and country including China 301 lists and AD/CVD, plus an email watchlist |
| Reporter (Priya) | National outlet, on deadline | Yes for Soft Power and FR search; not for daily numbers | An as-of date on every headline number, plus a dated daily "What changed" page |
| Supply-chain director (Tomás) | Auto parts, plants in Mexico | Maybe, for monitoring | Load forced-labor orders (WRO) and the UFLPA list; say "data unavailable" when a load fails |
| Retiree (Linda) | 68, iPad, fixed income | Not as is | Large-print "Tariffs and your wallet": price rises for food, medicine, appliances, cars next to the tariffs on each |
| Student (Jordan) | Poli-sci sophomore, phone, U.S.–China paper | Once, for the paper | One "U.S. vs China" page with plain definitions and a cite button per chart |
| Etsy seller (Keisha) | Jewelry side business, buys from China | Not yet | Plain "De minimis is gone: what it means for your packages" page with a worked $30 example, plus a product-code search |
| Steelworker (Mike) | Indiana, Android phone | Probably not | "Steel and tariffs" page with steel jobs and steel prices, tariff dates marked |
| Nurse and traveler (Ana) | Filipino-American, sends money home | Probably not yet | "For travelers and families" box on each country page: exchange rate in words, travel advisory, cost of sending money |

**What everyone praised:** every number has a source and a date somewhere; the honesty about scope ("Not evaluated, and not included in the total"); the Federal Register feed with citations, effective dates, comment deadlines and CSV export; the Guide's plain definitions and "What's this?" buttons; Soft Power's Pew charts ("37% vs 52%" with its caveat, the fixed nine-country panel, "Where the U.S. image has moved most"); the mobile bottom tab bar.

**The headline:** professionals trust the site's honesty but find the data too thin to act on. Ordinary people never find an answer to their own question, because every page starts from the importer's point of view. Each professional wants one specific dataset added; each ordinary visitor wants one plain-English page about their own life.

## Fix first: bugs and wording that several visitors hit

Verified in code where a file is named.

| # | Problem | Hit by | Where | Effort |
|---|---|---|---|---|
| 1 | **False "clean" result on forced labor.** China's Sanctions section says "0 Withhold Release Orders/Findings… None on file for China." The WRO source has never loaded; China has many active orders. Shown whenever the list is empty, without checking whether the source loaded. Not in the audit. | Supply chain | `frontend/src/pages/CountryDetail.tsx:447` | S |
| 2 | **Same pattern on sanctions.** "No new listings with a named country in the last 30 days" while SDN has never refreshed and CSL/UN stop at 2026-10-04. Rule: whenever a source is stale or missing, say so where the number is shown, never "none". | Export controls, reporter | Hard Power sanctions panel | S |
| 3 | **De minimis search card is wrong.** "A shipment valued under $800 is often, but not always, exempt from duty." Suspended since 2025-08-29; the calculator's own glossary says so. | Etsy seller | `frontend/src/lib/siteSearch.ts:217` | S |
| 4 | **Empty search looks broken.** "washing machine", "groceries", "cookware", "7323" all give "No actions in range yet. Try refreshing." Say "No notices mention X" and suggest other words. | Retiree, small importer | U.S. policy tab | S |
| 5 | **Search misses everyday words.** "car" suggests Madagascar and Nicaragua (substring match); "autos", "vehicle", "jobs", "travel", "customs allowance" find nothing; "USMCA" opens the military tab; "exclusion" returns patent orders; Enter on "de minimis" jumps to the calculator. Match whole words and add synonyms. | Steelworker, traveler, supply chain, small importer | Site search | S |
| 6 | **Sanctions counts differ between pages.** Russia 5,212 on Hard Power vs 5,220 on `/country/RU`; China 1,158 vs 1,181; UAE 748 vs 760. Russia shows only 13 CSL entries, UAE 1. | Export controls, reporter | Hard Power, country pages, Compare | S-M |
| 7 | **Compare is broken.** `?countries=US,CN` drops the U.S. silently and says "Both belong to G20 and BRICS"; four countries drops the fourth silently; the China page defaults to China vs Mexico; `/compare` lands at the top of Hard Power. | Student, supply chain, small importer | Hard Power Compare | S |
| 8 | **`/country/US` is empty**: "Nothing linked to US", "No country name provided, so this was skipped". The home globe links to it. | Steelworker, student | Country page | S (fix) / M (rebuild as "At home") |
| 9 | **"Export-control status: Verified export-control status"** with no value, on CN, AE, PH and others. | Export controls, supply chain, traveler | Country snapshot | S |
| 10 | **China and Vietnam look identical.** Both show "12.5%" and the same six sample products with the same totals. China's Section 301 lists are "NOT EVALUATED" inside each row. Say it once in bold at the top, and never show a bold "Total 50%" when a layer is not evaluated ("at least 50%"). | Small importer, broker, economist | Country tariff box, duty stack | S |
| 11 | **Sample reports say "generated" at the moment you open them** (it changes on reload) while the calculator page says "recorded 2026-09-23". | Broker, export controls, small importer, supply chain | Report header | S |
| 12 | **Wrong sample content.** Pen-and-notebook gift set classified as "sets of knives" (8211.10); Russia export sample cites §746.5 (Russia/Belarus rule is §746.8), leaves AT out, has no ENC/mass-market step, dismisses an SDN entity with a Russian address on name alone; Canadian bumper shows a 10% forced-labor 301 layer "stacked" on a USMCA-qualifying good while the Mexico page says USMCA goods are exempt; no Section 232 auto-parts layer on bumpers. Regenerating samples costs money (OWNER-TODO #6). | Small importer, export controls, broker, supply chain | Sample cases | S-M |
| 13 | **"Top U.S. trade action" is a Greek antiquities import rule.** Ranking is by document type then date, not importance. BIS's semiconductor remote-access rule came second. Every visitor noticed. | All 11 | Wire hero | S |
| 14 | **Topic tags.** CBP's "Heightened Requirements for Foreign Importers of Record" (effective Jan 5, new broker duties) is tagged "Other" and missing from "What matters most"; Section 232 pharma and paperwork notices are tagged "Export Control". | Broker, export controls | Feed tagging | S |
| 15 | **Currency direction contradicts itself.** Mexico card "Up 3.2%" (peso weakened) vs timeline "MXN strengthened 0.2%". Write it in words ("the peso weakened 3.2% against the dollar"); use full currency names (PHP sits next to "Mexican peso"). | Supply chain, traveler, steelworker, retiree | Ticker, country pages | S |
| 16 | **Markets tab contradicts the Guide.** Heading says "Stocks…" and quotes "come from Yahoo Finance"; the Guide says no stock indexes are shown but defines S&P 500 and VIX. Commodities have no units and are dated 2026-10-01. CPI shows only month-on-month as an index level (337.5) while producer prices show "vs a year ago". | Steelworker, retiree | Markets tab, Guide | S |
| 17 | **Soft power date error.** "Joseph Nye, who coined the term (*Soft Power*, 2004)". Nye coined it in 1990 (*Bound to Lead*); the 2004 book is a later treatment. Also the page heading is "Footprints and reach" and never says "Soft Power" at the top. | Student | `frontend/src/components/SoftOverview.tsx:145` | S |
| 18 | **Philippines page contradicts itself**: Overview lists 3 news items, Markets & news says "No recent headlines name Philippines"; "No tempo data yet. Try refreshing." Tourism figures here and in "Most visited countries" are from 2020. | Traveler | Country page | S |
| 19 | **Three freshness labels on the Wire**: "Live. Updated 3:48 AM", "Updated 23 hours ago", "Site last built 21 November 2026". Use one, with a time zone. | Reporter | Wire | S |
| 20 | **Small things**: `/glossary` is a 404; "Ctrl+K" hint on touch devices; Guide says "Start with the four highlights at the top" but there is a globe; Canada lists "Section 338 extra duty: 50%" three times; the forced-labor explanation repeats "capped at 15%" eleven times; "Policy tempo" axis has no years; the "Start" click creates an empty case record. | Several | Various | S |

## Data visitors asked for, ranked by demand

Counts are how many of the eleven asked for it independently. Sources are free and public unless noted.

### Asked for by four or more

1. **Effective U.S. tariff rate, monthly, total and by partner** (duties ÷ imports), with major actions marked and a CSV. *Economist, reporter, small importer, steelworker; the broker and retiree asked for the same idea per product.* USITC DataWeb calculated duties (dataweb.usitc.gov) and Census imports for consumption. This would replace the forced-labor 301 table as the headline tariff number.
2. **Lookup by HTS code and country, with every layer and no AI call**: MFN rate, China Section 301 Lists 1-4A, Section 232 (including auto parts and derivatives), forced-labor 301, AD/CVD, and the Chapter 99 heading. *Small importer, broker, Etsy seller, supply chain, retiree.* USITC HTS REST API (the site already holds 31,860 lines), USTR Section 301 pages. Overlaps with the audit's China 301 item and OWNER-TODO data work.
3. **AD/CVD orders in force by product and country**: case number, deposit rate, scope. *Broker, small importer, economist, steelworker (plain summaries).* CBP ADCVD search (aceservices.cbp.dhs.gov/adcvdweb), ITA AD/CVD proceedings (trade.gov). The site already ingests the notices; turning them into an "orders in force" table is mostly parsing.
4. **Monthly U.S. imports, exports and balance by partner and HS chapter**, to show trade exposure and diversion (China vs Vietnam vs Mexico). *Economist, reporter, student, supply chain, small importer (unit values).* Census International Trade API (api.census.gov/data/timeseries/intltrade), USA Trade Online.
5. **Consumer prices by everyday category, year over year**: food at home, prescription drugs, appliances, new and used cars, clothing, gasoline, next to the import price index. *Retiree, steelworker, Etsy seller, economist (import prices).* BLS CPI API: CUUR0000SAF11 (food at home), CUUR0000SEMF01 (Rx drugs), CUUR0000SEHK (appliances), CUSR0000SETA01/02 (new/used cars); BLS MXP import price indexes.
6. **Exchange-rate history (1 month, 1 year, 5 years) with volatility and a "what $X buys" converter**, every currency including PHP, INR, KRW. *Traveler, supply chain, steelworker, retiree.* ECB reference rates (already loaded), FRED H.10 (DEXMXUS, DEXJPUS, DEXKOUS, DEXCHUS).

### Asked for by two or three

7. **Daily "What changed" log** with a permalink per day: new FR actions, OFAC designations and delistings, Entity List additions, data refreshes. *Reporter, export controls, broker.* Federal Register API, OFAC Recent Actions (ofac.treasury.gov/recent-actions, has RSS).
8. **Designation feed at the level of each party**: who was added to or removed from SDN, the Entity List, EU and UK lists, with citation. *Export controls, reporter (monthly counts by program).* OFAC SLS delta files, FR abstracts for BIS rules, EU Financial Sanctions Files, UK Sanctions List.
9. **Forced-labor enforcement, loaded and working**: CBP WROs and Findings, a UFLPA Entity List mirror with date and sector, CBP UFLPA detention statistics. *Supply chain, broker.* cbp.gov forced-labor pages, dhs.gov/uflpa-entity-list.
10. **Customs duties collected, monthly** with fiscal-year-to-date. *Economist, reporter, steelworker.* Monthly Treasury Statement, "Customs Duties" line (fiscaldata.treasury.gov).
11. **Tariff status timeline per measure** (IEEPA/reciprocal, 232, 301, 338, 201): in effect, ended or enjoined, with FR citation at each step and any refund guidance. IEEPA and "reciprocal" are never mentioned on the site, though clients ask about refunds. *Broker, reporter, student (U.S.–China timeline).*
12. **CBP CSMS messages** tagged by program. *Broker, small importer.* CBP GovDelivery archive.
13. **MPF and HMF in dollars** (informal-entry amounts, formal min/max). *Broker, small importer, Etsy seller.* 19 CFR 24.23 and the annual CBP user-fee notice (already in OWNER-TODO).
14. **Freight and port indicators**: NY Fed Global Supply Chain Pressure Index, IMF PortWatch chokepoint transits, a container freight index. *Supply chain, small importer.* newyorkfed.org/research/policy/gscpi, portwatch.imf.org; Freightos FBX / Drewry WCI (check reuse terms).
15. **Country Groups and the Part 744/746 rules on each country page**, and the full CCL with license exceptions. *Export controls (audit item too).* eCFR API.
16. **China's own trade tools**: critical-mineral export controls (gallium, germanium, graphite, rare earths), Unreliable Entity List, retaliatory tariffs. *Supply chain, reporter, economist.* MOFCOM announcements, USGS Mineral Commodity Summaries, Global Trade Alert (wired up but never refreshed).
17. **Jobs in affected industries**: BLS employment for steel mills (NAICS 3311), fabricated metal (332), autos and parts (3361-3363), and by state. *Steelworker, economist (state exposure).* BLS CES (FRED CES3133110001), BLS QCEW.
18. **De minimis and parcel rules**: timeline, mail vs courier, who collects, fees; what a buyer abroad pays (Canada CAD 20/40 thresholds and GST/HST, UK VAT on parcels of £135 or less); traveler allowances ($800 duty-free, alcohol, food). *Etsy seller, traveler.* CBP de minimis and Know Before You Go pages, CBSA, GOV.UK.
19. **U.S. vs China over time**: GDP at market rates and PPP since 1990, SIPRI military series, U.S.–China bilateral trade since 1985, a "top trading partner: U.S. or China" map. *Student, reporter.* IMF WEO, World Bank WDI (PPP already in OWNER-TODO), SIPRI, Census c5700, IMF DOTS.
20. **Student and visitor flows**: IIE Open Doors, F-1 visas by nationality, recent visitor numbers instead of 2020. *Student, reporter, traveler.* opendoorsdata.org, State Dept NIV issuances, NTTO I-94 arrivals.

### Asked for by one, worth considering

- USMCA 2026 joint review tracker (supply chain). CBP rulings (CROSS) linked from each HTS code (broker). Section 301 exclusions with expiry dates, kept apart from Section 337 (small importer, broker). WTO disputes involving the U.S. (economist). Enforcement actions and penalties, BIS and OFAC (export controls). 50% rule ownership hints (export controls). CSL sub-lists shown separately (export controls). Port-level data and border wait times (broker, supply chain). CBP-certified exchange rates (broker). Steel output, imports and prices: AISI, Commerce SIMA, PPI WPU1017 (steelworker). Household tariff-cost estimates from Yale Budget Lab, Tax Foundation, CBO, labelled as estimates (retiree). Social Security COLA beside CPI-W, regional CPI (retiree). Cost of sending money home, World Bank Remittance Prices (traveler). State Dept travel advisory level per country (traveler). Foreign-born population by country and state, Census ACS B05006 (traveler). Chinese overseas lending, AidData (student; the aid map is blank for China). Pew "confidence in the U.S. president", Americans' views of China (reporter, student). A democracy index, V-Dem or Freedom House (student; also in the audit). Country risk scores, WGI and OECD (supply chain). A stock index, only if licensing allows; otherwise remove the "Stocks" wording (steelworker).

## Features and design, ranked

### For everyone

1. **Freshness where the number is.** An as-of date and a stale or failed chip on every list-derived or headline number, not only on Methodology. "No new listings" and "None on file" must become "data unavailable since …" when a source has not loaded. (S) *Reporter, export controls, supply chain, economist.*
2. **Watchlists and alerts.** Save HTS codes, countries and topics; get email or a filtered RSS feed when anything touching them changes. RSS and JSON feeds already exist, so filtered feed URLs are a first step. (M) *Broker, export controls, small importer, supply chain, steelworker.*
3. **Plain-English line on every notice and report.** "What this means" in one sentence on each Federal Register item (the current auto-summaries, "A final rule about tariffs from CBP", add nothing), and a summary at the top of each report ("about $Y on a $10,000 shipment; your broker must check …"). Fixed templates, no model call. (M) *Small importer, Etsy seller, retiree, steelworker, reporter.*
4. **A real glossary page** at `/glossary`, linked in the header, with tap-to-define underlines. Move the calculator's "Start here" glossary into it. Add HTS, de minimis, MPF, informal entry, who pays a tariff, sanction, Section 232/301/338, antidumping, CPI month-on-month vs year-on-year. Search should return definitions first. Remove the stock and VIX entries if no stocks are shown. (S-M) *Retiree, student, Etsy seller, traveler.*
5. **Charts you can reuse.** CSV with a metadata header (source, series code, unit, as-of, licence, ISO code and year per row) on every chart, including COFER, "Pace of U.S. trade actions" and "Policy tempo"; PNG/SVG export with the source baked in; a permalink per chart; a "Cite this chart" that gives a copyable citation, primary source first, with MLA added. (S-M) *Economist, reporter, student.*
6. **Calmer phone pages.** A three-line "What changed this week" above the globe (or a smaller globe); a jump-to-section menu; collapse long cards; scroll cues on clipped tab rows; hide the ticker on scroll. Hard Power is about 17,400px tall on a phone, Soft Power about 12,900px, the Wire about 7,800px. (M) *Student, steelworker, retiree, reporter, traveler, economist.*
7. **Bigger text.** Body text at 16px and labels at 14px minimum, plus an A/A+ control. On the policy tab 642 text elements are 12-13px and 7 are 16px. (S-M) *Retiree.*

### For ordinary people: one front door

8. **"For you" entry points on the home page**, each a short page with plain-question headings, 2-3 charts from the data above, "what we know / what's disputed", and sources:
   - **Tariffs and your wallet**: prices of food, medicine, appliances, cars over the past year next to the tariffs on each, with "which tariffs touch this item" cards for about ten household goods. *Retiree, steelworker.*
   - **Steel, cars and jobs**: industry jobs and prices with tariff dates marked, and a plain summary of USITC Pub. 5405. *Steelworker.*
   - **Buying and selling online**: de minimis timeline, mail vs courier, worked $30 example, product-code search, what your buyer abroad pays. *Etsy seller.*
   - **U.S. vs China**: the numbers the site already has (opinion 37/52, military $954B/$336B, GDP, students, aid) in one place, plus trends. *Student, reporter.*
   (M each)
9. **"For travelers and families" box on country pages**: the exchange rate and trend in words, travel advisory level, the cost of sending money, how many people from that country live in the U.S. Put it above sanctions and export-control details for ordinary visitors; one tester said the current intro "reads like a police file on my country." (M) *Traveler.*
10. **A "Simple view" toggle** that hides FR citations, HTS lines and section numbers and shows only the plain summaries. (M) *Retiree, student.*
11. **Reword for non-specialists**: "higher = worse" next to ranks such as Gini; units on commodities; "Tailor this page to your work" should also offer "I'm just curious" and "I shop or sell online". Translation (Spanish, Tagalog) later. (S; L for translation) *Retiree, student, traveler.*

### For professionals: make it citable and actionable

12. **Rank the Wire by importance, not document type.** Rename or rerank "Top U.S. trade action"; add a "This week for importers" digest; hide OMB paperwork notices by default; add agency, HTS-chapter and date-range filters and a "Journalist" preset; give Key dates a "see all" and an .ics export. (S-M) *Broker, reporter, small importer, export controls.*
13. **Country-specific sample products** instead of the same six for every country (MX 8708/8544/0702, VN 9403/6403/8517, CN 8471/9503/8504, plus cookware, appliances, toys, apparel). Put the duty stack one click from Overview. (M) *Broker, small importer.*
14. **Compare that works for real decisions**: up to five countries, trade metrics (imports, exports, balance, share of U.S. imports, effective rate), China+1 presets (Mexico, India, Thailand, Vietnam), a shareable URL, CSV/PDF export for a quarterly review. (M) *Economist, supply chain, small importer, student.*
15. **Landed-cost worksheet with no AI call**: HTS code, origin, value, freight and quantity in; duty, MPF, HMF and freight per unit out, for two origins side by side. (M) *Small importer, Etsy seller.*
16. **Client-shareable country tariff page** in plain English with an as-of date and "confirm with your broker". (M) *Broker.*
17. **Press needs**: a short credit line per chart, a press contact, and a dated public corrections log. (S) *Reporter.*
18. **Public JSON/CSV API** for the series. (M) *Economist.*

## Suggested order

1. **This week (all S):** fix-first items 1-5, 7-11, 13-17 and 19, and design item 1 (freshness chips). These remove wrong or misleading statements a first-time visitor sees in minutes.
2. **Next:** the HTS-and-country lookup (data 2) and the "Tariffs and your wallet" page (design 8), because they answer the most common question from both groups: "what does this tariff cost me?" Both build on data the site mostly holds already, plus the BLS CPI API.
3. **Then:** effective tariff rate and Census trade by partner (data 1 and 4), which unlock Compare, the economist's and reporter's headline numbers, and the U.S. vs China page.
4. **Then:** watchlists and alerts, the daily "What changed" page, and the forced-labor and designation feeds (data 7-9).
5. **Later:** traveler box, freight indicators, China's own tools, translation.

Check licences before adding Freightos, Drewry, S&P or Pew-derived exports (Pew is already OWNER-TODO #11).
