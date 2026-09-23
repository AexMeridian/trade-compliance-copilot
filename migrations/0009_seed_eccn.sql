-- Curated ECCN/CCL entries (15 CFR Part 774 Supplement 1). DELIBERATELY PARTIAL --
-- the full CCL runs to thousands of paragraphs/subparagraphs across 10 categories
-- (0-9) x 5 product groups (A-E). This is a representative spread: the EAR99
-- catch-all (where most everyday consumer goods land), plus a handful of
-- well-documented, stable dual-use entries spanning several categories so the
-- export module has real license-determinative cases to demonstrate, not just
-- an all-NLR baseline. Reasons-for-control and general structure verified via
-- BIS/eCFR sourcing; full multi-page paragraph text for each ECCN was NOT
-- individually re-derived from the CFR line-by-line -- descriptions below are
-- accurate summaries, not verbatim regulatory text, and should be confirmed
-- against 15 CFR 774 Supp. 1 before relying on this for an actual classification.

INSERT INTO eccn_entries (eccn, category, product_group, description, reasons_for_control, license_exceptions, citation, source_url, source_tier, last_updated) VALUES

('EAR99', 'N/A', 'N/A',
 'Not elsewhere classified on the Commerce Control List -- the catch-all classification for most commercial/consumer items subject to the EAR but not enumerated in any ECCN. No reason-for-control column applies by classification alone; screening/destination restrictions (denied parties, embargoed destinations, end-use/end-user rules) can still require a license.',
 '[]', '[]',
 '15 CFR 734.3',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-734/section-734.3', 1, '2026-09-22'),

('3A001', '3', 'A',
 'Electronic components and assemblies not specified elsewhere on the CCL, including specified integrated circuits, oscillators, and specialized electronic assemblies exceeding EAR-specified performance parameters (radiation-hardened, high-speed ADCs, certain frequency synthesizers, etc.) -- representative summary of a multi-paragraph entry.',
 '["NS","AT"]', '["GBS","TSR"]',
 '15 CFR Part 774, Supplement No. 1, Category 3 (Electronics), ECCN 3A001',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-09-22'),

('4A003', '4', 'A',
 'Digital computers and related equipment with an Adjusted Peak Performance (APP) exceeding EAR-specified thresholds, and "electronic assemblies" specially designed to enhance APP by aggregation -- representative summary; high-performance computing/AI-accelerator hardware is a frequently-updated sub-area of this ECCN.',
 '["NS","AT"]', '["APP","GBS"]',
 '15 CFR Part 774, Supplement No. 1, Category 4 (Computers), ECCN 4A003',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-09-22'),

('5A002', '5', 'A',
 '"Information security" systems, equipment, and components using cryptography for data confidentiality with a described security algorithm/key length exceeding the mass-market threshold (i.e. non-mass-market encryption hardware).',
 '["NS","EI"]', '["ENC","TSU"]',
 '15 CFR Part 774, Supplement No. 1, Category 5 Part 2 (Information Security), ECCN 5A002',
 'https://eccnfinder.com/guides/encryption-eccn-5a002-5d002/', 3, '2026-09-22'),

('5D002', '5', 'D',
 'Software specially designed or modified for the development, production, or use of equipment classified 5A002, or software implementing the described non-mass-market cryptographic functionality directly.',
 '["NS","EI"]', '["ENC","TSU"]',
 '15 CFR Part 774, Supplement No. 1, Category 5 Part 2 (Information Security), ECCN 5D002',
 'https://eccnfinder.com/guides/encryption-eccn-5a002-5d002/', 3, '2026-09-22'),

('5A992', '5', 'A',
 'Mass-market information security/encryption commodities (e.g. standard consumer devices and software using publicly available cryptographic algorithms within mass-market key-length thresholds) -- a far less restricted classification than 5A002, reflecting the EAR''s mass-market carve-out.',
 '["AT"]', '["MMTC","ENC"]',
 '15 CFR Part 774, Supplement No. 1, Category 5 Part 2 (Information Security), ECCN 5A992',
 'https://eccnfinder.com/guides/encryption-eccn-5a002-5d002/', 3, '2026-09-22'),

('1C350', '1', 'C',
 'Chemicals usable as precursors for toxic chemical agents, and certain lab/test kits or mixtures containing them above specified concentration thresholds (dual-use chemical precursor list).',
 '["CB","AT"]', '[]',
 '15 CFR Part 774, Supplement No. 1, Category 1 (Chemicals, Microorganisms), ECCN 1C350',
 'https://www.bis.gov/regulations/ear/742', 1, '2026-09-22'),

('6A003', '6', 'A',
 'Specified optical sensors, cameras, and related imaging/optical instrumentation exceeding EAR-specified resolution, frame-rate, or spectral-response thresholds (e.g. certain high-speed or infrared imaging cameras) -- representative summary of a multi-paragraph entry.',
 '["NS","RS","AT"]', '["GBS"]',
 '15 CFR Part 774, Supplement No. 1, Category 6 (Sensors and Lasers), ECCN 6A003',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-09-22');
