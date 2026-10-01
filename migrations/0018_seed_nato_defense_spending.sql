-- NATO defense expenditure as a share of GDP, 2014-2025 (2024/2025 are
-- NATO's own estimates, not final figures). Published annually as a PDF/
-- Excel factsheet, not an API -- a small, manually-curated, dated, cited
-- reference dataset (same philosophy as pulseBlocs.ts's static bloc
-- membership), re-verified by hand roughly once a year, not live-fetched.
--
-- Source: NATO, "Defence Expenditure of NATO Countries (2014-2025)",
-- published 28 August 2025 -- Table 3 ("Defence expenditure as a share of
-- GDP and annual real change"), PDF/XLSX at
-- https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025
-- Figures transcribed directly from NATO's own published Excel table, not
-- estimated or guessed. Limited to the 6 NATO members already tracked
-- elsewhere in this app (BLOC_MEMBERS.NATO in pulseBlocs.ts) plus the United
-- States itself, included as the comparison baseline this feature exists to
-- show -- not every one of NATO's 32 members.
--
-- Germany's 2025 figure is NULL, not a parsing gap: NATO's own published
-- table left it blank (no 2025 estimate for Germany at publication time) --
-- its own 2024 estimate (2.00%) is seeded instead, flagged by a distinct,
-- later last_fetched_at-adjacent note in the UI rather than silently
-- treating it as a same-year figure.
INSERT INTO market_series_meta (series_id, label, unit, source, source_url, last_fetched_at) VALUES
('NATO_DEFENSE_PCT:CA', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28'),
('NATO_DEFENSE_PCT:FR', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28'),
('NATO_DEFENSE_PCT:DE', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28'),
('NATO_DEFENSE_PCT:IT', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28'),
('NATO_DEFENSE_PCT:TR', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28'),
('NATO_DEFENSE_PCT:GB', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28'),
('NATO_DEFENSE_PCT:US', 'Defence expenditure, % of GDP', 'percent of GDP', 'NATO', 'https://www.nato.int/en/news-and-events/articles/news/2025/08/28/defence-expenditure-of-nato-countries-2014-2025', '2025-08-28');

INSERT INTO market_series (series_id, obs_date, value) VALUES
-- Canada
('NATO_DEFENSE_PCT:CA', '2014-12-31', 1.01), ('NATO_DEFENSE_PCT:CA', '2015-12-31', 1.20), ('NATO_DEFENSE_PCT:CA', '2016-12-31', 1.16),
('NATO_DEFENSE_PCT:CA', '2017-12-31', 1.44), ('NATO_DEFENSE_PCT:CA', '2018-12-31', 1.30), ('NATO_DEFENSE_PCT:CA', '2019-12-31', 1.29),
('NATO_DEFENSE_PCT:CA', '2020-12-31', 1.41), ('NATO_DEFENSE_PCT:CA', '2021-12-31', 1.27), ('NATO_DEFENSE_PCT:CA', '2022-12-31', 1.20),
('NATO_DEFENSE_PCT:CA', '2023-12-31', 1.33), ('NATO_DEFENSE_PCT:CA', '2024-12-31', 1.47), ('NATO_DEFENSE_PCT:CA', '2025-12-31', 2.01),
-- France
('NATO_DEFENSE_PCT:FR', '2014-12-31', 1.82), ('NATO_DEFENSE_PCT:FR', '2015-12-31', 1.78), ('NATO_DEFENSE_PCT:FR', '2016-12-31', 1.79),
('NATO_DEFENSE_PCT:FR', '2017-12-31', 1.78), ('NATO_DEFENSE_PCT:FR', '2018-12-31', 1.81), ('NATO_DEFENSE_PCT:FR', '2019-12-31', 1.82),
('NATO_DEFENSE_PCT:FR', '2020-12-31', 1.99), ('NATO_DEFENSE_PCT:FR', '2021-12-31', 1.90), ('NATO_DEFENSE_PCT:FR', '2022-12-31', 1.87),
('NATO_DEFENSE_PCT:FR', '2023-12-31', 1.94), ('NATO_DEFENSE_PCT:FR', '2024-12-31', 2.03), ('NATO_DEFENSE_PCT:FR', '2025-12-31', 2.05),
-- Germany (2025 not estimated by NATO at publication time -- 2024 is this series' latest point)
('NATO_DEFENSE_PCT:DE', '2014-12-31', 1.16), ('NATO_DEFENSE_PCT:DE', '2015-12-31', 1.16), ('NATO_DEFENSE_PCT:DE', '2016-12-31', 1.18),
('NATO_DEFENSE_PCT:DE', '2017-12-31', 1.21), ('NATO_DEFENSE_PCT:DE', '2018-12-31', 1.23), ('NATO_DEFENSE_PCT:DE', '2019-12-31', 1.33),
('NATO_DEFENSE_PCT:DE', '2020-12-31', 1.49), ('NATO_DEFENSE_PCT:DE', '2021-12-31', 1.43), ('NATO_DEFENSE_PCT:DE', '2022-12-31', 1.48),
('NATO_DEFENSE_PCT:DE', '2023-12-31', 1.61), ('NATO_DEFENSE_PCT:DE', '2024-12-31', 2.00),
-- Italy
('NATO_DEFENSE_PCT:IT', '2014-12-31', 1.13), ('NATO_DEFENSE_PCT:IT', '2015-12-31', 1.06), ('NATO_DEFENSE_PCT:IT', '2016-12-31', 1.17),
('NATO_DEFENSE_PCT:IT', '2017-12-31', 1.19), ('NATO_DEFENSE_PCT:IT', '2018-12-31', 1.22), ('NATO_DEFENSE_PCT:IT', '2019-12-31', 1.17),
('NATO_DEFENSE_PCT:IT', '2020-12-31', 1.58), ('NATO_DEFENSE_PCT:IT', '2021-12-31', 1.52), ('NATO_DEFENSE_PCT:IT', '2022-12-31', 1.50),
('NATO_DEFENSE_PCT:IT', '2023-12-31', 1.47), ('NATO_DEFENSE_PCT:IT', '2024-12-31', 1.50), ('NATO_DEFENSE_PCT:IT', '2025-12-31', 2.01),
-- Turkiye
('NATO_DEFENSE_PCT:TR', '2014-12-31', 1.45), ('NATO_DEFENSE_PCT:TR', '2015-12-31', 1.38), ('NATO_DEFENSE_PCT:TR', '2016-12-31', 1.45),
('NATO_DEFENSE_PCT:TR', '2017-12-31', 1.51), ('NATO_DEFENSE_PCT:TR', '2018-12-31', 1.82), ('NATO_DEFENSE_PCT:TR', '2019-12-31', 1.85),
('NATO_DEFENSE_PCT:TR', '2020-12-31', 1.86), ('NATO_DEFENSE_PCT:TR', '2021-12-31', 1.61), ('NATO_DEFENSE_PCT:TR', '2022-12-31', 1.36),
('NATO_DEFENSE_PCT:TR', '2023-12-31', 1.48), ('NATO_DEFENSE_PCT:TR', '2024-12-31', 2.13), ('NATO_DEFENSE_PCT:TR', '2025-12-31', 2.33),
-- United Kingdom
('NATO_DEFENSE_PCT:GB', '2014-12-31', 2.14), ('NATO_DEFENSE_PCT:GB', '2015-12-31', 2.03), ('NATO_DEFENSE_PCT:GB', '2016-12-31', 2.09),
('NATO_DEFENSE_PCT:GB', '2017-12-31', 2.08), ('NATO_DEFENSE_PCT:GB', '2018-12-31', 2.10), ('NATO_DEFENSE_PCT:GB', '2019-12-31', 2.08),
('NATO_DEFENSE_PCT:GB', '2020-12-31', 2.35), ('NATO_DEFENSE_PCT:GB', '2021-12-31', 2.29), ('NATO_DEFENSE_PCT:GB', '2022-12-31', 2.27),
('NATO_DEFENSE_PCT:GB', '2023-12-31', 2.25), ('NATO_DEFENSE_PCT:GB', '2024-12-31', 2.33), ('NATO_DEFENSE_PCT:GB', '2025-12-31', 2.40),
-- United States
('NATO_DEFENSE_PCT:US', '2014-12-31', 3.71), ('NATO_DEFENSE_PCT:US', '2015-12-31', 3.51), ('NATO_DEFENSE_PCT:US', '2016-12-31', 3.49),
('NATO_DEFENSE_PCT:US', '2017-12-31', 3.28), ('NATO_DEFENSE_PCT:US', '2018-12-31', 3.25), ('NATO_DEFENSE_PCT:US', '2019-12-31', 3.49),
('NATO_DEFENSE_PCT:US', '2020-12-31', 3.61), ('NATO_DEFENSE_PCT:US', '2021-12-31', 3.48), ('NATO_DEFENSE_PCT:US', '2022-12-31', 3.21),
('NATO_DEFENSE_PCT:US', '2023-12-31', 3.10), ('NATO_DEFENSE_PCT:US', '2024-12-31', 3.21), ('NATO_DEFENSE_PCT:US', '2025-12-31', 3.22);
