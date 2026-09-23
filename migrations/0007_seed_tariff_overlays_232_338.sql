-- Section 232 (steel/aluminum/copper/autos) and Section 338 (Canada) tariff overlay
-- config. All rates/dates verified against Federal Register / White House proclamation
-- text as of 2026-09-22 (data_as_of). hts_pattern is a prefix match against the
-- resolved HTS code with dots stripped (e.g. '72' matches all of Chapter 72,
-- '8703' matches heading 8703, '%' matches everything).
--
-- KNOWN LIMITATION (documented, not hidden): several of these programs carve out
-- specific 8-digit tariff lines within a chapter/heading (e.g. Section 338's
-- Canada dairy tranche covers 52 specific 8-digit lines within Chapter 04, not
-- the whole chapter). This app encodes overlay coverage at chapter/heading
-- granularity with an explicit note field flagging that line-item confirmation
-- against the cited proclamation's annex is required before relying on the
-- result for a real transaction. This is called out in the UI provenance badge.

-- ---------------------------------------------------------------------------
-- Section 232: steel, aluminum, copper (Proclamation 11032, further adjusting
-- the June 2025 base action; Federal Register 2026-11314, published 2026-06-04;
-- effective 2026-06-08). Legal basis: Section 232, Trade Expansion Act of 1962
-- (19 U.S.C. 1862).
-- ---------------------------------------------------------------------------
INSERT INTO tariff_overlays (program, hts_pattern, country_scope, rate_pct, rate_type, legal_basis, effective_date, expiration_date, exclusions, stacking_rule, source_url, source_tier, last_updated, data_as_of) VALUES
('sec232_steel', '72', NULL, 50.0, 'ad_valorem',
 'Section 232, Trade Expansion Act of 1962 (19 U.S.C. 1862); Proclamation 11032, "Further Adjusting the Tariff Regimes for Imports of Aluminum, Steel, and Copper Into the United States" (Federal Register 2026-11314, June 4 2026)',
 '2026-06-08', '2027-12-31',
 '["Certain steel derivative articles carry a reduced 15% transitional rate through 2027-12-31 for specific categories (agricultural equipment, residential HVAC components, certain industrial machinery) -- not encoded line-item; consult Proclamation 11032 Annex.", "Country-level 15% total-duty caps apply for EU, UK, Japan, South Korea, Argentina, Ecuador, El Salvador, Guatemala, Liechtenstein, Switzerland, Taiwan -- see per-country cap rows in this table."]',
 'Applies in addition to Column 1 General/Special HTS rate. Section 338 excludes any good already dutiable under Section 232 from also incurring the Section 338 Canada overlay.',
 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states',
 1, '2026-09-22', '2026-09-22'),

('sec232_aluminum', '76', NULL, 50.0, 'ad_valorem',
 'Section 232, Trade Expansion Act of 1962 (19 U.S.C. 1862); Proclamation 11032, "Further Adjusting the Tariff Regimes for Imports of Aluminum, Steel, and Copper Into the United States" (Federal Register 2026-11314, June 4 2026)',
 '2026-06-08', '2027-12-31',
 '["Certain aluminum derivative articles carry a reduced 15% transitional rate through 2027-12-31 for specific categories -- not encoded line-item; consult Proclamation 11032 Annex.", "Country-level 15% total-duty caps apply for EU, UK, Japan, South Korea, Argentina, Ecuador, El Salvador, Guatemala, Liechtenstein, Switzerland, Taiwan -- see per-country cap rows in this table."]',
 'Applies in addition to Column 1 General/Special HTS rate. Section 338 excludes any good already dutiable under Section 232 from also incurring the Section 338 Canada overlay.',
 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states',
 1, '2026-09-22', '2026-09-22'),

('sec232_copper', '74', NULL, 50.0, 'ad_valorem',
 'Section 232, Trade Expansion Act of 1962 (19 U.S.C. 1862); Proclamation 11032, "Further Adjusting the Tariff Regimes for Imports of Aluminum, Steel, and Copper Into the United States" (Federal Register 2026-11314, June 4 2026)',
 '2026-06-08', '2027-12-31',
 '["A 25% (not 50%) rate applies to certain copper articles and select derivative products -- this app does not yet distinguish those specific 8-digit lines from the 50% baseline; treat the 50% figure as an upper-bound estimate pending line-item confirmation against Proclamation 11032 Annex."]',
 'Applies in addition to Column 1 General/Special HTS rate.',
 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states',
 1, '2026-09-22', '2026-09-22'),

-- Country-level 15% total-duty caps (steel/aluminum/copper) -- app logic must apply
-- these as a cap on the combined 232 duty for the listed country, not an addition.
('sec232_metals_country_cap', '%', 'EU', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["This is a CAP on total Section 232 metals duty, not an additive rate -- apply min(baseline_232_rate, 15%) for this country_scope."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'GB', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'JP', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'KR', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'AR', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'EC', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'SV', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'GT', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'LI', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'CH', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),
('sec232_metals_country_cap', '%', 'TW', 15.0, 'ad_valorem', 'Proclamation 11032 (Federal Register 2026-11314), country-specific total-duty cap arrangement', '2026-06-08', '2027-12-31', '["Cap, not additive -- apply min(baseline_232_rate, 15%)."]', 'Overrides the 50%/25% baseline rate for this country only.', 'https://www.federalregister.gov/documents/2026/06/04/2026-11314/further-adjusting-the-tariff-regimes-for-imports-of-aluminum-steel-and-copper-into-the-united-states', 1, '2026-09-22', '2026-09-22'),

-- ---------------------------------------------------------------------------
-- Section 232: autos and auto parts (Proclamation 10908, effective 2025-04-03
-- vehicles / 2025-05-03 parts; MHDV/buses under Proclamation 10984). Rates
-- unchanged as of 2026-09-22 per CBP guidance.
-- ---------------------------------------------------------------------------
('sec232_autos', '8703', NULL, 25.0, 'ad_valorem',
 'Section 232, Trade Expansion Act of 1962 (19 U.S.C. 1862); Proclamation 10908 ("Adjusting Imports of Automobiles and Automobile Parts Into the United States")',
 '2025-04-03', NULL,
 '["An import adjustment offset (3.75% of aggregate MSRP through 2026-04-30, then 2.5% through 2027-04-30) is available to U.S. vehicle assemblers against Section 232 duty owed on imported parts -- modeled as a note, not a rate reduction, since it is a manufacturer-level credit program, not a per-shipment exemption."]',
 'Applies in addition to Column 1 General/Special HTS rate.',
 'https://www.cbp.gov/trade/programs-administration/entry-summary/section-232-additional-faqs-autos',
 1, '2026-09-22', '2026-09-22'),

('sec232_autos', '8704', NULL, 25.0, 'ad_valorem',
 'Section 232, Trade Expansion Act of 1962 (19 U.S.C. 1862); Proclamation 10908 ("Adjusting Imports of Automobiles and Automobile Parts Into the United States")',
 '2025-04-03', NULL,
 '["Covers light trucks under heading 8704; medium/heavy-duty trucks and buses are covered separately under Proclamation 10984."]',
 'Applies in addition to Column 1 General/Special HTS rate.',
 'https://www.cbp.gov/trade/programs-administration/entry-summary/section-232-additional-faqs-autos',
 1, '2026-09-22', '2026-09-22'),

-- NOTE: Section 232 auto PARTS (as distinct from finished vehicles above) are
-- deliberately NOT encoded as a tariff_overlays row. The real covered-parts
-- list spans many HTS headings (engines/engine parts, transmissions/
-- powertrain, electrical components, etc.) across multiple chapters, expanded
-- periodically via a quarterly inclusions process -- there is no single
-- defensible hts_pattern prefix for it. An earlier draft of this migration
-- used hts_pattern='%' as a placeholder, which is wrong: it would apply a 25%
-- surcharge to every product regardless of category. Per this app's "never
-- fabricate -- disclose the gap" policy, auto-parts Section 232 coverage is
-- simply not modeled here; see scripts/refresh_data.md for how to add it
-- properly (a real per-heading pattern list) if this app is extended.

-- ---------------------------------------------------------------------------
-- Section 338 (Canada) -- three Proclamations of 2026-07-20 (Alcoholic
-- Beverages: Proclamation 11046, FR 2026-14991; Dairy: FR 2026-14992; Motor
-- Vehicles: FR 2026-14997), effective date originally 2026-08-19, suspended
-- 3 days by Proclamation 11056 (2026-08-18), actually took effect 2026-08-22
-- 12:01am ET after the suspension lapsed. Legal basis: Section 338, Tariff Act
-- of 1930 (19 U.S.C. 1338). NOTE: Federal Register shows further modification/
-- exclusion notices dated 2026-09-14 for at least the alcoholic-beverages
-- tranche (documents 2026-18835, 2026-18836, 2026-18838) -- this app has NOT
-- parsed those follow-on modifications; treat scope below as the 2026-08-22
-- baseline and flag for manual verification of any September 2026 changes.
-- ---------------------------------------------------------------------------
('sec338_canada', '22', 'CA', 50.0, 'ad_valorem',
 'Section 338, Tariff Act of 1930 (19 U.S.C. 1338); Proclamation 11046, "Imposing Additional Duties To Offset Canadian Discrimination Against the Commerce of the United States With Respect to Alcoholic Beverages" (Federal Register 2026-14991, July 23 2026)',
 '2026-08-22', NULL,
 '["Covers 63 specific 8-digit tariff lines within Chapter 22, not the full chapter -- line-item confirmation against the Proclamation 11046 Annex required.", "Energy products, potash, fish, and critical minerals are excluded government-wide from all three Section 338 Canada tranches.", "Possible scope modification per Federal Register 2026-18835/2026-18838 (Sept 14 2026) -- not yet reflected in this row; verify before relying on it."]',
 'Goods already dutiable under Section 232 are excluded from Section 338 (no stacking); applies regardless of USMCA origin qualification.',
 'https://www.federalregister.gov/documents/2026/07/23/2026-14991/imposing-additional-duties-to-offset-canadian-discrimination-against-the-commerce-of-the-united',
 1, '2026-09-22', '2026-09-22'),

('sec338_canada', '04', 'CA', 50.0, 'ad_valorem',
 'Section 338, Tariff Act of 1930 (19 U.S.C. 1338); Proclamation "Imposing Additional Duties To Offset Canadian Discrimination Against the Commerce of the United States With Respect to Dairy" (Federal Register 2026-14992, July 23 2026)',
 '2026-08-22', NULL,
 '["Covers 52 specific 8-digit tariff lines within Chapter 04, not the full chapter -- line-item confirmation against the proclamation Annex required.", "Energy products, potash, fish, and critical minerals are excluded government-wide from all three Section 338 Canada tranches."]',
 'Goods already dutiable under Section 232 are excluded from Section 338 (no stacking); applies regardless of USMCA origin qualification.',
 'https://www.federalregister.gov/documents/2026/07/23/2026-14992/imposing-additional-duties-to-offset-canadian-discrimination-against-the-commerce-of-the-united',
 1, '2026-09-22', '2026-09-22'),

('sec338_canada', '87', 'CA', 50.0, 'ad_valorem',
 'Section 338, Tariff Act of 1930 (19 U.S.C. 1338); Proclamation "Imposing Additional Duties To Offset Canadian Discrimination Against the Commerce of the United States With Respect to Motor Vehicles" (Federal Register 2026-14997, July 23 2026)',
 '2026-08-22', NULL,
 '["Covers 439 specific 8-digit tariff lines within Chapter 87, not the full chapter -- line-item confirmation against the proclamation Annex required.", "0% additional-rate carve-outs apply to certain passenger/commercial vehicles and parts already covered by Section 232, per the anti-stacking rule.", "Energy products, potash, fish, and critical minerals are excluded government-wide from all three Section 338 Canada tranches."]',
 'Goods already dutiable under Section 232 are excluded from Section 338 (no stacking) -- this is the dominant interaction for motor vehicles, since Section 232 autos (see sec232_autos rows) already covers much of Chapter 87. Applies regardless of USMCA origin qualification.',
 'https://www.federalregister.gov/documents/2026/07/23/2026-14997/imposing-additional-duties-to-offset-canadian-discrimination-against-the-commerce-of-the-united',
 1, '2026-09-22', '2026-09-22');
