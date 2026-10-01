-- CBP Withhold Release Orders & Findings (Section 307, 19 U.S.C. 1307):
-- merchandise/entities CBP has formally determined are produced with forced
-- labor and barred from entry. This is a broader, older program than the
-- newer DHS "UFLPA Entity List" (Uyghur Forced Labor Prevention Act) -- that
-- list has no bulk CSV/API (DHS publishes it only as an HTML table on
-- dhs.gov/uflpa-entity-list), so this app ingests the real structured feed
-- CBP does publish rather than build a fragile HTML scraper against a page
-- that could change shape without notice; dhs.gov is linked out to directly
-- for the UFLPA-specific list instead (see CountryDetail.tsx's panel copy).
--
-- Full DELETE + reinsert on each refresh, same reasoning as csl_entries: a
-- status change (e.g. an order revoked) must not persist as stale "Active".
CREATE TABLE wro_findings (
  id INTEGER PRIMARY KEY,
  effective_date TEXT,
  country_code TEXT, -- ISO 3166-1 alpha-2, as CBP's own CSV already provides it
  country TEXT,
  merchandise TEXT,
  order_type TEXT NOT NULL, -- 'WRO' | 'Finding'
  industry TEXT,
  status TEXT NOT NULL, -- 'Active' | 'Revoked' | ...
  entity TEXT,
  remarks TEXT,
  source_url TEXT NOT NULL,
  last_updated TEXT NOT NULL
);
CREATE INDEX idx_wro_country ON wro_findings(country_code, status);
