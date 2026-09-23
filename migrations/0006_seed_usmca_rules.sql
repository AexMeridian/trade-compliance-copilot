-- USMCA rules of origin, curated from General Note 11 of the HTSUS (implementing
-- USMCA Chapter 4, Annex 4-B for automotive). DELIBERATELY PARTIAL coverage --
-- General Note 11 runs to hundreds of chapter/heading-specific provisions; only
-- the chapters below were verified against primary/authoritative secondary
-- sources with enough specificity to encode responsibly. A heading with no
-- matching row here must be reported by the app as "not curated," never guessed.

-- Chapters 84 & 85 (machinery, mechanical appliances, electrical equipment):
-- general default RVC thresholds. NOTE: many individual 84/85 subheadings carry
-- their own more specific tariff-shift text in GN 11(o)/(p) that isn't
-- individually encoded here -- this row is the general fallback figure (the RVC
-- percentages themselves -- 60% transaction value / 50% net cost -- are the
-- correctly verified, widely-applicable USMCA default) and should be read as
-- "the RVC threshold is right; the tariff-shift text is a general pattern, not
-- necessarily this exact subheading's specific GN 11 text."
INSERT INTO usmca_rules (hts_chapter, heading_pattern, rule_type, tariff_shift_text, rvc_threshold_pct, rvc_method, de_minimis_pct, citation, source_url, source_tier, last_updated, notes) VALUES
('84', '84', 'tariff_shift_or_rvc',
 'A change to the heading from any other heading (chapter/subheading-specific exceptions exist and are not individually encoded here)',
 60.0, 'either', 10.0,
 'General Note 11, HTSUS; CBP USMCA Fact Sheet: Regional Value Content',
 'https://www.cbp.gov/document/fact-sheets/usmca-fact-sheet-regional-value-content', 1, '2026-09-22',
 'RVC default: not less than 60% under the transaction value method, or not less than 50% under the net cost method (encoded as rvc_threshold_pct=60 for transaction_value; use 50 if rvc_method=net_cost is selected). General 10% de minimis for non-originating materials applies per GN 11. Several Chapter 84 subheadings carry their own specific tariff-shift rule in GN 11(o) that supersedes this general row -- verify against the actual subheading text before relying on this for a specific product.'),

('85', '85', 'tariff_shift_or_rvc',
 'A change to the heading from any other heading (chapter/subheading-specific exceptions exist and are not individually encoded here)',
 60.0, 'either', 10.0,
 'General Note 11, HTSUS; CBP USMCA Fact Sheet: Regional Value Content',
 'https://www.cbp.gov/document/fact-sheets/usmca-fact-sheet-regional-value-content', 1, '2026-09-22',
 'Same RVC structure as Chapter 84 (60% transaction value / 50% net cost, 10% general de minimis). Several Chapter 85 subheadings (e.g. certain electronics) carry their own specific GN 11(p) tariff-shift rule not individually encoded here.'),

-- Chapter 87 (vehicles): the USMCA-specific, heavily-negotiated automotive
-- rules -- 75% RVC for passenger vehicles/light trucks (up from NAFTA's 62.5%),
-- calculated primarily via the net cost method per Annex 4-B, PLUS non-RVC
-- requirements (labor value content, NA steel/aluminum purchasing) that this
-- app's schema does not model numerically.
('87', '8703', 'rvc', NULL, 75.0, 'net_cost', NULL,
 'General Note 11, HTSUS, incorporating USMCA Annex 4-B (Product-Specific Rules for the Automotive Sector), Art. 4.1/4.2',
 'https://ustr.gov/sites/default/files/files/agreements/FTA/USMCA/Text/04-Rules-of-Origin.pdf', 1, '2026-09-22',
 'Passenger vehicle RVC threshold is 75% (increased from NAFTA''s 62.5%), calculated primarily under the net cost method. USMCA additionally requires: (1) each of 7 defined "core parts" (engine, transmission, body/chassis, axle, suspension, steering, advanced battery where applicable) to independently meet a 75% RVC (or averaged across core parts); (2) at least 70% of a producer''s steel and aluminum purchases originate in North America; (3) labor value content (LVC) certification -- >=40% of production at >=$16/hr average base wage for passenger vehicles. This app models only the headline 75% RVC test; the core-parts, steel/aluminum-purchasing, and LVC requirements are real, load-bearing USMCA conditions NOT evaluated here and must be flagged as open issues for a human analyst on any Chapter 87 case.'),

('87', '8704', 'rvc', NULL, 75.0, 'net_cost', NULL,
 'General Note 11, HTSUS, incorporating USMCA Annex 4-B (Product-Specific Rules for the Automotive Sector), Art. 4.1/4.2',
 'https://ustr.gov/sites/default/files/files/agreements/FTA/USMCA/Text/04-Rules-of-Origin.pdf', 1, '2026-09-22',
 'Light truck RVC threshold is 75%, net cost method. Same core-parts / steel-aluminum-purchasing / labor-value-content caveats as heading 8703 apply (LVC threshold is 45% for light trucks, vs 40% for passenger vehicles) and are not modeled numerically by this app.'),

('87', '87', 'tariff_shift_or_rvc', 'A change to the heading from any other heading', 60.0, 'either', 10.0,
 'General Note 11, HTSUS; CBP USMCA Fact Sheet: Regional Value Content',
 'https://www.cbp.gov/document/fact-sheets/usmca-fact-sheet-regional-value-content', 1, '2026-09-22',
 'General fallback for Chapter 87 goods OTHER than passenger vehicles/light trucks (headings 8703/8704, which carry the elevated 75% Annex 4-B automotive rule above): standard motor vehicle parts and accessories (e.g. heading 8708) follow the ordinary tariff-shift-or-RVC(60% TV / 50% NC) rule, not the special core-parts threshold, which applies only to the seven Annex 4-B core parts (engine, transmission, body/chassis, axle, suspension, steering, advanced battery).'),

-- Chapters 61 & 62 (apparel): "yarn-forward" rule -- the defining, well-known
-- USMCA textile rule. Not RVC-based; a strict tariff-shift/production-step rule.
('61', '61', 'tariff_shift',
 'Yarn-forward: the formation of yarn, the weaving or knitting of fabric, and the cutting and sewing of the garment must all occur within the USMCA territory (US/Canada/Mexico) for the good to originate.',
 NULL, NULL, 10.0,
 'General Note 11, HTSUS; USMCA Chapter 6 (Textile and Apparel Goods)',
 'https://www.cbp.gov/trade/nafta/guide-customs-procedures/provisions-specific-sectors/textiles', 1, '2026-09-22',
 'Textile-specific de minimis: non-originating fibers/yarns not meeting the tariff classification test may total up to 10% of the weight of the good/component (elastomeric content capped separately at 7% within that 10%). De minimis applies to fiber/yarn content only -- it cannot be used to excuse non-originating finished fabric (e.g. an 8%-by-value non-originating fabric still fails yarn-forward outright).'),

('62', '62', 'tariff_shift',
 'Yarn-forward: the formation of yarn, the weaving or knitting of fabric, and the cutting and sewing of the garment must all occur within the USMCA territory (US/Canada/Mexico) for the good to originate.',
 NULL, NULL, 10.0,
 'General Note 11, HTSUS; USMCA Chapter 6 (Textile and Apparel Goods)',
 'https://www.cbp.gov/trade/nafta/guide-customs-procedures/provisions-specific-sectors/textiles', 1, '2026-09-22',
 'Same yarn-forward rule and de minimis structure as Chapter 61 (10% general / 7% elastomeric sub-cap).'),

('63', '63', 'tariff_shift',
 'Yarn-forward, extended to made-up textile articles: formation of yarn, fabric production, and cutting/sewing must occur within the USMCA territory.',
 NULL, NULL, 10.0,
 'General Note 11, HTSUS; USMCA Chapter 6 (Textile and Apparel Goods)',
 'https://www.cbp.gov/trade/nafta/guide-customs-procedures/provisions-specific-sectors/textiles', 1, '2026-09-22',
 'Same yarn-forward rule and de minimis structure as Chapters 61-62, applied to made-up textile articles (e.g. bed linen, curtains) rather than apparel proper.');
