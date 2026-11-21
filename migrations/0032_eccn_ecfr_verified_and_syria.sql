-- Replaces the hand-written ECCN rows from 0009 with entries re-derived from the eCFR (15 CFR Part 774 Supp. 1 and 746.9, text as of 2026-11-19),
-- checked on 2026-11-21. Corrections: 3A001 (NS, RS, MT, NP, AT; NS Column 2 for the whole entry), 4A003 (NS, RS, CC, AT; the AI-accelerator
-- language is removed, those items are 3A090/4A090), 5A002 and 5D002 (NS Column 1, RS, AT, EI; ENC is the exception), 5A992 (RS, AT; MMTC is not a
-- license exception), 6A003 (NS Column 2, NP, RS, AT, UN; GBS is N/A), 1C350 (CB Column 2, CW, AT; the chart is not used for CW or AT). Added 3A090 and 4A090.
--
-- reasons_for_control now carries the Country Chart column where the eCFR gives one: "NS2" = NS Column 2 for the whole entry. A trailing "?" means the
-- control applies only to some paragraphs (or is set by country group, not by the chart), so the app must say "verify" instead of deciding.
-- license_exceptions lists only exceptions the eCFR marks "Yes" for the entry; paragraph limits are not modelled, so the app always says "verify".
-- This is still a handful of the roughly 3,000 CCL entries. Summaries below are not regulatory text.
DELETE FROM eccn_entries WHERE eccn != 'EAR99';
UPDATE eccn_entries SET last_updated = '2026-11-21', source_tier = 1 WHERE eccn = 'EAR99';

INSERT INTO eccn_entries (eccn, category, product_group, description, reasons_for_control, license_exceptions, citation, source_url, source_tier, last_updated) VALUES

('3A001', '3', 'A',
 'Electronic items (electronic components, integrated circuits, microwave/millimeter-wave parts, oscillators, high-energy capacitors and similar), by paragraph. Controls differ by paragraph: NS Column 2 applies to the entire entry; NS Column 1 and RS Column 1 only to MMIC amplifiers and discrete microwave transistors (3A001.b.2, b.3); MT and NP only to listed paragraphs; RS also applies to 3A001.z by country group. List-based license exceptions (LVS, GBS) are paragraph-specific. AI accelerators and advanced computing chips are in 3A090, not here.',
 '["NS2","NS1?","RS1?","RS?","MT1?","NP1?","AT1"]', '[]',
 '15 CFR Part 774, Supplement No. 1, ECCN 3A001 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('3A090', '3', 'A',
 'Integrated circuits meeting the advanced-computing thresholds (the AI accelerator and high-end GPU entry), plus certain high-bandwidth memory. RS applies by destination group (Country Groups D:1, D:4, D:5, the UAE, and for 3A090.c Macau), not by Country Chart column. Exceptions (NAC/ACA, HBM, ACM) are paragraph-specific. Servers and computers built with these chips are 4A090.',
 '["RS?","AT1"]', '[]',
 '15 CFR Part 774, Supplement No. 1, ECCN 3A090 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('4A003', '4', 'A',
 'Digital computers, electronic assemblies and related equipment, by paragraph (NS Column 1 for 4A003.b, .c and .z.1; NS Column 2 for 4A003.g and .z.2; RS for 4A003.z by country group; CC Column 1 for fingerprint-equipment computers). Computers up to 70 Weighted TeraFLOPS are largely NLR outside Country Groups E:1/E:2. AI-accelerator systems are in 4A090 and 3A090, not here.',
 '["NS1?","NS2?","RS?","CC1?","AT1"]', '["APP","GBS"]',
 '15 CFR Part 774, Supplement No. 1, ECCN 4A003 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('4A090', '4', 'A',
 'Computers and related equipment, electronic assemblies and components incorporating 3A090 integrated circuits (AI servers and accelerator systems). RS applies by destination group (Country Groups D:1, D:4, D:5 and the UAE), not by Country Chart column.',
 '["RS?","AT1"]', '[]',
 '15 CFR Part 774, Supplement No. 1, ECCN 4A090 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('5A002', '5', 'A',
 '"Information security" systems, equipment and components using cryptography for data confidentiality and similar functions. NS Column 1 and AT Column 1 apply to the entire entry; EI (encryption items, 15 CFR 742.15) applies to the entire entry; RS applies to the 5A002.z paragraph by country group. License Exception ENC (740.17) is the main exception and has its own eligibility conditions. GBS is N/A.',
 '["NS1","RS?","AT1","EI?"]', '["ENC"]',
 '15 CFR Part 774, Supplement No. 1, Category 5 Part 2, ECCN 5A002 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('5D002', '5', 'D',
 'Software specially designed for, or implementing, the cryptographic functionality in 5A002 and related. NS Column 1 and AT Column 1 apply to the entire entry; EI applies to listed paragraphs; RS applies to 5D002.z by country group. ENC (740.17) is available for certain EI-controlled software; TSR is N/A.',
 '["NS1","RS?","AT1","EI?"]', '["ENC"]',
 '15 CFR Part 774, Supplement No. 1, Category 5 Part 2, ECCN 5D002 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('5A992', '5', 'A',
 'Equipment not controlled by 5A002, including mass-market encryption commodities (5A992.c). AT Column 1 applies to the entire entry; RS applies only to 5A992.z by country group. LVS and GBS are N/A. "MMTC" is not a license exception.',
 '["RS?","AT1"]', '[]',
 '15 CFR Part 774, Supplement No. 1, Category 5 Part 2, ECCN 5A992 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('6A003', '6', 'A',
 'Cameras, systems and equipment, and components, by paragraph (thermal and high-speed imaging cameras and similar). NS Column 2 applies to the entire entry; NP Column 1 to 6A003.a.3, a.4 and a.6; RS Column 1 or 2 to 6A003.b.3 and b.4 depending on frame rate and array size; UN to 6A003.b.3 and b.4 (746.1(b)). GBS is N/A; LVS is paragraph-specific.',
 '["NS2","NP1?","RS1?","RS2?","AT1","UN?"]', '[]',
 '15 CFR Part 774, Supplement No. 1, ECCN 6A003 (eCFR text as of 2026-11-19)',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21'),

('1C350', '1', 'C',
 'Chemicals that may be used as precursors for toxic chemical agents, and mixtures containing them. CB Column 2 applies to the entire entry. CW applies to 1C350.b and .c and is NOT decided by the Country Chart: a license is needed for Schedule 2 and 3 chemicals to States not Party to the CWC (742.18, 745.2). AT also bypasses the chart: a license is needed to Country Group E:1. Sample-shipment and concentration rules apply.',
 '["CB2","CW?","AT?"]', '[]',
 '15 CFR Part 774, Supplement No. 1, ECCN 1C350 (eCFR text as of 2026-11-19); 15 CFR 742.18; 15 CFR 745.2',
 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774/appendix-Supplement%20No.%201%20to%20Part%20774', 1, '2026-11-21');

-- Syria: 15 CFR 746.9 (as amended 90 FR 42320, Sept. 2, 2025). A license is still required for all items subject to the EAR (except EAR99 food and
-- medicine), but License Exception SPP (740.5) is now available for EAR99 items; Part 744 end-use/end-user rules still apply.
UPDATE country_chart_coverage
SET notes = 'Embargo under 15 CFR 746.9: a license is required for all items subject to the EAR except EAR99 food and medicine. Since 2025-09-02 (90 FR 42320) License Exception SPP (740.5) is available for EAR99 items; CCL items still need a license. Part 744 end-use/end-user controls and any OFAC listings still apply; verify before shipping.',
    last_updated = '2026-11-21'
WHERE country_code = 'SY';
