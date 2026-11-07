# Calculator accuracy: what has been measured, what was fixed, what is open

Tested 2026-11-02 against the reference data loaded locally (HTS 2026-09-23 revision, 31,860 lines; OFAC SDN list, 19,393 entries).
Run the free checks with `npm run test:unit`; run the heavier measurements with `npm run test:accuracy` (needs the local database that
`wrangler dev` creates; both skip when it is missing). No model calls were made for any figure below.

The standard: never a confident wrong answer. "Can't tell, review this" is an acceptable result; a wrong rate or a missed sanctions
listing is not.

## 1. Rate parsing across the whole HTS (`tests/accuracy/hts-rate-audit.test.ts`)

Every Column 1 General rate and all 116,900 program entries in the Special column were run through the parsers and compared with a
separate plain reading of the same text.

| | Before | After |
|---|---|---|
| General-rate lines read differently from the plain reading | 22 | 0 |
| Compound rates read as one percentage | 22 | 0 |

The bug: a rate such as "3.9% on the movement and case + 5.3% on the battery" or "4.7% on the value of the rifle + 20% on the value of
the telescopic sight" was read as only its first number (3.9% or 4.7%), so the duty was understated with no warning. These are now sent
to manual review like any other non-ad-valorem rate. Affected headings include watches (9102 to 9114), firearms (9301, 9303), lead
products (7801) and a few others.

Coverage: of 11,414 lines that carry their own General rate, 10,178 (89.2%) are "Free" or a single percentage and can be totaled; 1,236
(10.8%) have specific or compound rates (cents per kilogram and similar) and always go to manual review. Supporting specific rates would
need quantity and weight inputs the calculator does not collect.

## 2. Duty-stack arithmetic (`tests/duty-stack.test.ts`)

Nine scenarios with hand-computed totals were added: Section 232 steel with and without a country cap (the cap replaces the 50%, never
adds to it, never raises it), autos, Section 232 versus Section 338 anti-stacking for Canada, Section 301 forced labor, a qualifying
USMCA good with additional duties, and specific rates. All pass.

**Finding, fixed: Section 338 (Canada).** The overlay rows match whole chapters (04, 22, 87), but the proclamations cover only specific
8-digit lines (52 in chapter 04, 63 in chapter 22, 439 in chapter 87, per each row's own note). The calculator was adding the full 50% to
every Canadian line in those chapters, an overstatement for most goods. It now shows the line as undetermined and withholds the total
(case verdict: review required) until the annex line lists are loaded.

## 3. Party screening: name search and scoring (`tests/accuracy/screening-benchmark.test.ts`)

400 listed SDN names, each changed the way real input changes, and the share that still reach the reviewer's top five candidates:

| Change to the listed name | Before | After |
|---|---|---|
| Typed exactly | 99.8% | 100.0% |
| Lower case, no punctuation | 99.3% | 99.5% |
| Words reordered | 97.3% | 97.0% |
| One middle word missing | 81.8%* | 95.3% |
| Two letters swapped | 97.0% | 99.5% |
| One letter dropped | 96.3% | 99.0% |
| One wrong letter | not measured | 99.3% |
| One extra letter | not measured | 99.8% |
| Legal suffix added | 99.5% | 100.0% |
| A listed alias, as typed (200) | 100% | 99.5% |

\* The "before" figure used a harsher test (any word, including the distinctive one, could be dropped).

Causes found and fixed:
- A name with one-character words ("S 7 ENGINEERING LLC") could not be found even when typed exactly, because the search discarded
  one-character words and was then flooded by the common words "engineering" and "llc".
- A typo in the only distinctive word returned zero candidates, because full-text search matches whole words. The search now also tries
  spellings one swapped pair or one missing letter away, and the first four letters of long words.
- A name with a middle or generic word left out scored below the 0.55 gate on letter overlap alone ("ALSTONE AG" against "ALSTONE
  INVESTMENT AG"). A pair where every typed word appears in the listed name and one is distinctive now scores between 0.6 and 0.8.
- Only one trailing legal word was removed when comparing names, so "HARA COMPANY LLC" and "HARA COMPANY" did not match. All trailing
  legal words are now removed.

Noise: of 30 ordinary names that are not listed, 22 put at least one candidate in front of the reviewer and 3 put one scoring 0.85 or
higher (before the changes: 20 and 3). The reviewer and the model judge each candidate; none of these becomes a hard stop on its own.

Remaining misses (under 5% per category): short company names where the one distinctive word is very common in the lists, and word
orders that are nonsensical ("COMPANY LIABILITY LIMITED LEDA"). Not yet addressed.

## 3b. Classification: is the right subheading among the candidates? (`tests/accuracy/classification-retrieval.test.ts`)

The model can only choose among the schedule lines the search returns, so the search sets the ceiling. 99 everyday products
(`tests/accuracy/classification-set.json`) were labelled with their international 6-digit subheading, each checked to exist in the loaded
schedule, and the calculator's own search was run on each description.

| | Before | After |
|---|---|---|
| Correct subheading among the candidates | 86/99 (86.9%) | 97/99 (98.0%) |

Causes found and fixed:
- Everyday words the schedule does not use ("laptop", "lipstick", "shopping bags", "sneakers", "monitor", "truck") found nothing relevant.
  A small, documented table (`src/lib/htsSynonyms.ts`) adds the schedule's own words to the search. One entry ("jeans") made a case worse
  in testing and was removed, which is why the table is checked against this set whenever it changes.
- When the search found a 4-digit heading ("8704 Motor vehicles for the transport of goods") but none of its subheadings, the right answer
  (8704.22) never reached the model. The search now also pulls the subheading rows beneath the first three matched headings.

Still missing: "cotton fabric, woven, unbleached, plain weave" (5208.11) and a quartz wristwatch with a base-metal case (9102.11).

## 3c. Classification: model-scored run (`npm run test:accuracy:model`), run once on 2026-11-03

One run, 107 model calls (99 labelled products and 8 deliberately vague descriptions), no errors. Raw result: 94 correct, 5 flagged for
review, 8 confident wrong. Each non-correct result was checked against the schedule's own text:

- **6 of the 8 "confident wrong" were wrong labels, not wrong answers.** The model was right and the label was mine: refined copper wire
  2 mm (7408.19, the 7408.11 line is for wire over 6 mm), an electric guitar (9207.90, 9207.10 is keyboard instruments), acrylic paint
  sold singly (3213.90, 3213.10 is sets), a strung pearl necklace (7116.10, 7101.22 is loose pearls), an adjustable wrench (8204.12,
  8204.11 is non-adjustable), and the innerspring mattress (9404.29; 9404.21 is foam). Labels corrected. One more, bottled water (2201.10 mineral waters
  versus 2201.90 other), is genuinely ambiguous and was removed from the set.
- **2 were real model errors, both misreading a numeric limit:** black tea in 2 kg packages was put under "over 3 kg" (0902.40) instead of
  "not exceeding 3 kg" (0902.30), and a 5 mm hot-rolled coil under "3 mm to under 4.75 mm" (7208.38) instead of "4.75 mm to 10 mm" (7208.37).
- **The 4 other flagged results were appropriate:** the description does not say what decides the answer (fabric weight, whether the
  fabric is dyed, the watch's display type, the knife type). The model flagged them as ambiguous instead of guessing.
- All 8 vague descriptions ("Tools", "Clothing", "Machine parts") were flagged, not answered.

Corrected: about 99 of 107 right or appropriately flagged, 2 confident wrong (1.9%). A single run does not measure run-to-run
stability; that needs a second run (another 107 calls) and has not been done to save cost.

Change made for the two real errors, not yet re-tested with the model: the classification prompt now tells the model to compare any
numeric limit in a candidate line with the figure in the description, and to flag when the deciding figure is missing. Checking it takes
about 2 calls (just those two products); the free retrieval test is unchanged (96/98 on the corrected set).

Re-test of the two real errors, 2 calls, with the numeric-limit prompt rule: both still wrong. The model's own reasoning named the right code
in both cases (for the tea, "0902.30.00.90 ... (<= 3 kg)") but the code it recorded was different. Cause: in the forced tool the answer
field came before the reasoning field, and the model writes fields in order, so it committed to a code first and then reasoned. Fixed
in all four model tools (classification, origin, export ECCN, screening verdicts): reasoning now comes first, and
`tests/tool-order.test.ts` guards the order. Re-tested with 2 more calls: black tea now 0902.30 and the 5 mm coil 7208.37, both correct.
The other three tools were reordered the same way and have not been run with the model.

### Second full run (2026-11-03, after the numeric-limit rule and the reasoning-first reorder)

106 calls (98 labelled products with the corrected labels, 8 vague descriptions), no errors after one resume: the first attempt stopped
after 21 products on three connection errors between this machine and the Anthropic API (not billing, not the key), and the runner was
resumed from the first failed product (`--skip 18`).

| | Run 1 (corrected labels) | Run 2 |
|---|---|---|
| Correct | about 99 of 107 | 100 of 106 |
| Flagged for review (appropriate) | 4 | 5 |
| Confident wrong | 2 | 1 |

Run to run, 101 of 106 products got the same 6-digit subheading (95.3%). Of the 5 that differed, 2 were the tea and steel-coil fixes
working, 2 (eyeglass frames, "Machine parts") were flagged ambiguous both times, and 1 is a real instability: uncoated A4 copy paper was
flagged ambiguous in run 1 and answered with 4802.57 (not flagged) in run 2. The description gives no weight, and the correct line
(4802.56) depends on sheet size and the other on weight, so the right answer is to flag it. The one remaining confident-wrong result is this
product. Still open: stronger flagging when the deciding fact is missing. Run 2 used the reordered tools, so it also confirms the
reasoning-first change did not hurt overall accuracy.

## 4. Duty rules checked against the Federal Register notices

The three notices behind the additional-duty data were read from the Government Publishing Office's copies of the Federal Register
(federalregister.gov blocks automated readers, and that block was not worked around). The text of each notice was readable; every annex
(the product lists) is an image in the published notice and could not be read, so product-level coverage is still unverified.

Found and fixed (each now has a hand-computed test in `tests/duty-stack.test.ts`):
- **Section 232 metals, 15% jurisdictions (Argentina, Ecuador, El Salvador, Guatemala, Japan, Korea, Liechtenstein, Switzerland, Taiwan, the
  U.K. and EU members), Proclamation 11032 clause (2)(b).** The text says the Column 1 rate plus the Section 232 rate "shall be 15
  percent", and the 232 rate is zero where Column 1 is already 15 percent or more. The calculator added a flat 15% on top of the Column 1
  rate, overstating the total by the Column 1 rate (a 2.5% line came out at 17.5%, should be 15%).
- **Section 301 forced-labor action (USTR, July 28, 2026).**
  - Goods subject to Section 232 duties are exempt (Annex I, clause (f)). The calculator added both. Fixed: the 301 line now shows as exempt.
  - Canadian and Mexican goods entered duty-free under USMCA are exempt (clauses (g) and (h)). The calculator charged 10% regardless. Fixed:
    exempt when USMCA qualification is confirmed, withheld (total not shown) when it has not been determined, charged when goods do not qualify.
  - For the EU, Taiwan, Japan, Korea and Switzerland, the notice sets the combined duty ("the sum of the MFN tariff and the section 301
    tariff shall be 10 percent", 12.5 for Japan, Korea and Switzerland) and zero where the MFN rate already meets it. The calculator added
    the full 10 or 12.5 on top. Fixed.
- **Section 338 dairy (Proclamation 11047).** Confirmed: 50% on "certain products of Canada, as identified in Annex II", not on the whole
  chapter, and not on goods subject to Section 232. This matches the earlier fix (line undetermined, total withheld). The row's effective
  date in the data (2026-08-22) differs from the proclamation's (August 19, 2026); the other two Canada rows (chapters 22 and 87) were not read.

Still unverified, because the annexes are images:
- Which derivative articles outside chapters 72, 74 and 76 carry Section 232 duties (Annex I-C and others); the proclamation sets a 25%
  default for Annex I-C articles, 10% for articles made entirely of U.S.-smelted metal, and 25% on the non-U.S. content for USMCA goods, none
  of which the data models. The data's 50% rate for chapters 72, 74 and 76 matches the base proclamation's rate for "products made of those
  metals" per its recital, but copper's rate was not confirmed.
- The product exemptions in the Section 301 action (Annexes I and II, including pharmaceuticals and the country-specific lists).
- The Section 338 line lists for chapters 04, 22 and 87.
- No IEEPA, Section 122, MPF/HMF, antidumping or countervailing duty, or Chapter 99 logic exists; Section 301 on China is not evaluated.
  The case verdict is already forced to review for China-origin goods.

## 5. Origin, ECCN and screening: model-scored runs (2026-11-03/04)

Harness: `tests/accuracy/module-model.ts` (`--suite origin|eccn|screening`), labelled sets in `origin-set.ts` and `eccn-set.ts`; screening
parties are drawn from the loaded lists at a fixed stride plus 26 ordinary names. **The first pass was cut short** (the Anthropic account ran out
of credit during the ECCN run, and an overlapping launch of mine doubled some calls); the second pass below completed it. First-pass results:

- **Origin (40 scenarios, two complete runs).** Run A: 35 correct, 1 confident wrong, 4 abstained. Run B: 33 correct, 0 confident wrong, 7
  abstained. The confident wrong: U.S. parts finished in China came back "qualifies". Fixed by code: final assembly outside the U.S., Canada
  and Mexico now returns "does not qualify" without a model call. The abstentions (for example a laptop whose foreign inputs are all in other
  headings) are safe but lose answers a person could give; the headings are in the component descriptions. A fix (compute the originating
  share in code and hand it to the model) is not made because it cannot be measured without more credit.
- **ECCN (17 to 20 of 34 products before credit ran out).** All 14 covered products were selected correctly (3A001, 4A003, 5A002, 5D002,
  5A992, 1C350, 6A003), as were the ordinary goods reached (EAR99). **Not measured:** the 6 strategic products (lasers, inertial navigation,
  propellant oxidizer, CNC, night vision, satellite parts) and the 4 edge cases. Those are the test of the new "possibly controlled elsewhere"
  flag, and it is unproven.
- **Found by reading the ECCN results (free):** 1C350, a chemical-weapons precursor, to Germany came out "No License Required, clear". The
  chart data marks only the National Security columns for the six allies, so every other reason was treated as "not marked". The Country
  Chart marks CB Column 1 for most countries, Germany included. Fixed: a reason outside the verified columns (NS, plus AT) now gives
  "Insufficient Data", so an ECCN controlled for CB, NP, MT or RS to an ally is flagged unless an NS match already decides it.
- **Second pass after credit was added (2026-11-06).**
  - **ECCN, the 10 products not reached before:** 10 of 10 correct (6 strategic products flagged, never "EAR99, clear"; 4 edge cases within the accepted answers). Combined with the first pass, all 34 products are correct; the "possibly controlled elsewhere" flag worked on every strategic product.
  - **Screening, 50 parties:** all 24 listed parties (SDN companies, perturbed spellings, SDN individuals, Entity List, UN, UK) came back as a confirmed true match; none missed. Of 26 ordinary names, 22 were clean, 4 inconclusive (flagged for review), 0 false true matches. Individuals were matched on name alone because the screen takes no date of birth.
  - **Origin, 40 scenarios, after fixing a bug in my own assembly-country rule (it treated the U.S. as outside USMCA; found by this run):** 36 correct, 0 confident wrong, 0 missed, 4 abstained. The abstentions are all change-of-heading cases (handset and power tool with a same-heading foreign part, a machine just under 60%, a television), where "insufficient" is the safe answer.

Changes made without model measurement, each covered by a free test: model sees the whole ECCN table (8 entries) instead of a text-search
shortlist; the "possibly controlled elsewhere" field; the CB-column guard; non-USMCA assembly rule; import duty summary written by code
(removes one model call per import case); 14-day cache of identical model answers; the regional-value arithmetic is done in code
(`src/lib/originMath.ts`) when every component has a value and the shares add to 100, which settles 12 of the 40 labelled origin scenarios
with no model call, each agreeing with its label (`tests/origin-math.test.ts`). Rules with a tariff-shift alternative are never failed on value alone.

## 6. Keeping data current without model calls

See README ("What is not auto-applied") and docs/OPERATIONS.md. Dry run of the change watcher on the stored notices since the curated data's
2026-09-22 date found 5 real notices (two USMCA, one Section 301 exclusion amendment, two Section 232: polysilicon under Proclamation 11052
and specialty pharmaceuticals). Until someone reviews them, cases touching those programs show "review required".

## 7. Still open

- Measured model cost (96 calls, 2026-11-06): about $0.02 per call (origin 1,666 in / 1,154 out tokens, screening party 1,849 / 820, ECCN 1,874 / 648), $1.88 in total.
- Dairy row date: the row says 2026-08-22 and its own note attributes it to a three-day suspension (Proclamation 11056) of the 2026-08-19 date
  in the proclamation. I did not change it and did not re-read Proclamation 11056.
- The MPF dollar limits (fiscal years 2026 and 2027) come from carrier and broker notices; the CBP notice itself could not be fetched.
- Annex product lists (Section 232 derivatives, Section 301 Annexes I and II, Section 338 chapters 04, 22 and 87) are images and unread.
  Antidumping and countervailing duties, IEEPA and Section 122 measures, and Section 201 are not modelled; every import case now says so.
- Country Chart: only NS columns are verified for the six allies; fill the other columns from a source that can be read.
- End-to-end cases checked by a licensed customs broker.

Results here show agreement with public sources, not legal sign-off.
