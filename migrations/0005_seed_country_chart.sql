-- Commerce Country Chart (15 CFR 738 Supp. 1) -- DELIBERATELY PARTIAL curation.
--
-- The full chart covers ~180 destinations x up to 8 reason-for-control categories
-- (CB, NP, NS, MT, RS, FC, CC, AT), each with 1-3 numbered columns. An automated
-- fetch of the eCFR table during this build produced internally inconsistent
-- results for several non-allied destinations (e.g. it marked Israel identically
-- to Russia/China/Belarus across every single column, which is not plausible)
-- and was discarded rather than trusted -- see the code-review note in
-- scripts/refresh_data.md. Only the rows below were verified with enough
-- confidence (either cross-corroborated across independent fetches, or backed by
-- long-stable, well-documented EAR structure) to encode as primary-source data.
--
-- Everything else is intentionally left uncurated (see country_chart_coverage's
-- 'not_curated' default) rather than guessed. This is a real, disclosed
-- limitation: an export case to an uncurated destination must render "insufficient
-- country-chart data -- flag for manual review," never a fabricated NLR/License
-- Required answer.

-- --- Curated: Wassenaar/close-ally destinations, NS Column 1 + NS Column 2 only ---
-- (corroborated identically across independent lookups for each of these six;
-- consistent with the well-documented EAR structure where National Security
-- controls reach nearly all destinations while other reason categories are
-- reserved for higher-risk destinations)
-- reason_for_control stores the granular column id (e.g. 'NS1', 'NS2') so that a
-- country marked on one column of a reason but not another can be represented --
-- the UNIQUE(country_code, reason_for_control) constraint operates at this
-- granularity. control_level carries the human-readable label.
INSERT INTO country_chart (country_code, country_name, reason_for_control, control_level, source_url, source_tier, last_updated) VALUES
('CA', 'Canada', 'NS1', 'National Security, Column 1', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('CA', 'Canada', 'NS2', 'National Security, Column 2', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('GB', 'United Kingdom', 'NS1', 'National Security, Column 1', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('GB', 'United Kingdom', 'NS2', 'National Security, Column 2', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('DE', 'Germany', 'NS1', 'National Security, Column 1', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('DE', 'Germany', 'NS2', 'National Security, Column 2', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('JP', 'Japan', 'NS1', 'National Security, Column 1', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('JP', 'Japan', 'NS2', 'National Security, Column 2', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('MX', 'Mexico', 'NS1', 'National Security, Column 1', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('MX', 'Mexico', 'NS2', 'National Security, Column 2', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('KR', 'South Korea', 'NS1', 'National Security, Column 1', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22'),
('KR', 'South Korea', 'NS2', 'National Security, Column 2', 'https://www.law.cornell.edu/cfr/text/15/appendix-Supplement_No_1_to_part_738', 1, '2026-09-22');

INSERT INTO country_chart_coverage (country_code, country_name, status, notes, source_url, source_tier, last_updated) VALUES
('CA', 'Canada', 'curated', 'Verified: NS Column 1 and NS Column 2 only. No other reason-for-control columns marked.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-738/appendix-Supplement%20No.%201%20to%20Part%20738', 1, '2026-09-22'),
('GB', 'United Kingdom', 'curated', 'Verified: NS Column 1 and NS Column 2 only.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-738/appendix-Supplement%20No.%201%20to%20Part%20738', 1, '2026-09-22'),
('DE', 'Germany', 'curated', 'Verified: NS Column 1 and NS Column 2 only.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-738/appendix-Supplement%20No.%201%20to%20Part%20738', 1, '2026-09-22'),
('JP', 'Japan', 'curated', 'Verified: NS Column 1 and NS Column 2 only.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-738/appendix-Supplement%20No.%201%20to%20Part%20738', 1, '2026-09-22'),
('MX', 'Mexico', 'curated', 'Verified: NS Column 1 and NS Column 2 only.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-738/appendix-Supplement%20No.%201%20to%20Part%20738', 1, '2026-09-22'),
('KR', 'South Korea', 'curated', 'Verified: NS Column 1 and NS Column 2 only.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-738/appendix-Supplement%20No.%201%20to%20Part%20738', 1, '2026-09-22'),

-- --- Comprehensively embargoed destinations: governed by EAR Part 746, not plain
-- country-chart X marks. Stable, long-standing, high-confidence classification. ---
('CU', 'Cuba', 'comprehensive_embargo', 'Comprehensive embargo -- see 15 CFR Part 746 (Country Group E:1). License required for virtually all exports/reexports; most license exceptions unavailable.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746', 1, '2026-09-22'),
('IR', 'Iran', 'comprehensive_embargo', 'Comprehensive embargo -- see 15 CFR Part 746 and OFAC Iran sanctions program. License required for virtually all exports/reexports.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746', 1, '2026-09-22'),
('KP', 'North Korea', 'comprehensive_embargo', 'Comprehensive embargo -- see 15 CFR 742.19 and 746.4 (Country Group E:2). License required for virtually all exports/reexports.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746', 1, '2026-09-22'),
('SY', 'Syria', 'comprehensive_embargo', 'Comprehensive embargo -- see 15 CFR 746.9. License required for virtually all exports/reexports.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746', 1, '2026-09-22'),

-- --- Near-comprehensive restriction: Russia/Belarus under EAR 746.5/746.8
-- (post-2022 rules; license required for nearly all items, EAR99 included, with
-- narrow exceptions -- a well-established, stable policy posture, not the
-- standard reason-for-control chart mechanism). ---
('RU', 'Russia', 'broad_restriction_746_5', 'Near-comprehensive license requirement under 15 CFR 746.5 (Russia/Belarus rules) -- covers most EAR99 items in addition to all CCL items, with narrow, specific exceptions. This app does not encode the exception list; any Russia destination must be flagged for manual review rather than resolved automatically.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746/section-746.5', 1, '2026-09-22'),
('BY', 'Belarus', 'broad_restriction_746_5', 'Near-comprehensive license requirement under 15 CFR 746.8 (Belarus rules, aligned with 746.5) -- covers most EAR99 items in addition to all CCL items, with narrow, specific exceptions. Flag for manual review.', 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746/section-746.8', 1, '2026-09-22');

-- All other destinations (including China -- a fetch attempt for China's row
-- produced results indistinguishable from the discarded block above and was not
-- trusted) are intentionally left with no country_chart_coverage row, i.e.
-- 'not_curated' by the schema's documented default. See scripts/refresh_data.md
-- for how to extend this table once verified against the primary eCFR/CFR text.
