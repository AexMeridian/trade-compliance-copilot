-- Country indicators for the Power profile (development finance, attraction, knowledge, governance, hard-power context).
-- One row per indicator, not one per country-year: a 3-country comparison plus the dot plots needs every country's latest value,
-- so a long table would cost ~50,000 rows read per uncached view while this costs about 25. data_json is
-- {"CC": [[year, value], ...]} (oldest first, up to 12 non-empty points per country, alpha-2 codes).
-- Refreshed weekly by src/lib/refresh/powerIndicators.ts from the World Bank Indicators API (CC BY 4.0).
CREATE TABLE indicator_snapshot (
  indicator   TEXT PRIMARY KEY,   -- stable id, e.g. 'oda_given_usd'
  source_code TEXT NOT NULL,      -- the upstream series code, e.g. 'DC.ODA.TOTL.CD'
  fetched_at  TEXT NOT NULL,
  data_json   TEXT NOT NULL
);
