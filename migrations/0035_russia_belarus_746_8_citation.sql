-- Russia and Belarus: cite the right section. The licence requirement for every item on the Commerce Control List is 15 CFR 746.8
-- (sanctions against Russia and Belarus); 15 CFR 746.5 is the separate industry-sector rule that adds listed EAR99 items. The earlier
-- note cited only 746.5 for Russia, which an export-controls reviewer flagged. Wording only: the status and the "flag for manual review"
-- handling are unchanged.
-- Sources: https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746/section-746.8
--          https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746/section-746.5

UPDATE country_chart_coverage
SET notes = 'Near-comprehensive licence requirement. 15 CFR 746.8 requires a licence for every item on the Commerce Control List to Russia, and 15 CFR 746.5 adds listed EAR99 items (industry-sector sanctions), with narrow, specific exceptions. This app does not encode the exceptions, so any Russia destination is flagged for manual review rather than resolved automatically.',
    source_url = 'https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-746/section-746.8'
WHERE country_code = 'RU' AND status = 'broad_restriction_746_5';

UPDATE country_chart_coverage
SET notes = 'Near-comprehensive licence requirement. 15 CFR 746.8 requires a licence for every item on the Commerce Control List to Belarus, and 15 CFR 746.5 adds listed EAR99 items, with narrow, specific exceptions. Flag for manual review.'
WHERE country_code = 'BY' AND status = 'broad_restriction_746_5';
