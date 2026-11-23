-- Antidumping and countervailing duty (AD/CVD) orders in force, for the tariff lookup and the calculator report ("orders may apply: verify").
-- Rows are loaded from a saved official export by scripts/build-adcvd.ts, which writes the migration that fills this table (numbers 0111 onward).
-- No free, keyless, automated source was reachable when this was written (see src/lib/adcvd.ts), so the table starts empty and the site
-- says "not loaded" instead of implying that no order exists.
CREATE TABLE IF NOT EXISTS adcvd_orders (
  case_number  TEXT PRIMARY KEY,           -- Commerce case number, for example A-570-001 (antidumping) or C-570-002 (countervailing)
  order_type   TEXT NOT NULL,              -- 'AD' or 'CVD'
  country_code TEXT NOT NULL,              -- ISO 3166-1 alpha-2 of the country the order covers
  country      TEXT NOT NULL,
  product      TEXT NOT NULL,              -- short product description as published
  order_date   TEXT,                       -- date the order was published, YYYY-MM-DD
  rate_min     REAL,                       -- lowest published cash-deposit rate in percent, when published
  rate_max     REAL,                       -- highest published rate in percent (China-wide and "all others" rates included), when published
  hts_prefixes TEXT,                       -- comma-separated digit-only HTS prefixes named by the order, when the source has them
  chapters     TEXT,                       -- comma-separated two-digit HTS chapters, when only a chapter is known
  source       TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  as_of        TEXT NOT NULL               -- date of the export the row came from, YYYY-MM-DD
);
CREATE INDEX IF NOT EXISTS idx_adcvd_orders_country ON adcvd_orders (country_code);
