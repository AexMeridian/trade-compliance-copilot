-- Curated compliance-rule tables: USMCA rules of origin (General Note 11), ECCN/CCL
-- entries, the Commerce Country Chart (15 CFR 738 Supp. 1), and tariff overlay config
-- (Section 232/301/338). These are hand-curated, citation-bearing data, not bulk-fetched.

CREATE TABLE usmca_rules (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  hts_chapter         TEXT NOT NULL,
  heading_pattern     TEXT NOT NULL,     -- e.g. "8471" or "8471.30-8471.49"
  rule_type           TEXT NOT NULL,     -- tariff_shift | rvc | tariff_shift_or_rvc | tariff_shift_and_rvc
  tariff_shift_text   TEXT,
  rvc_threshold_pct   REAL,
  rvc_method          TEXT,              -- transaction_value | net_cost | either
  de_minimis_pct      REAL,
  citation            TEXT NOT NULL,     -- e.g. "General Note 11(o), Chapter 84"
  source_url          TEXT NOT NULL,
  source_tier         INTEGER NOT NULL,
  last_updated        TEXT NOT NULL,
  notes                TEXT
);
CREATE INDEX idx_usmca_heading ON usmca_rules(heading_pattern);
CREATE INDEX idx_usmca_chapter ON usmca_rules(hts_chapter);

CREATE TABLE eccn_entries (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  eccn                  TEXT NOT NULL,
  category              TEXT NOT NULL,   -- CCL Category 0-9
  product_group         TEXT NOT NULL,   -- A-E within category
  description           TEXT NOT NULL,
  reasons_for_control   TEXT NOT NULL,   -- JSON array, e.g. ["NS","MT","AT"]
  license_exceptions    TEXT,            -- JSON array
  citation               TEXT NOT NULL,   -- 15 CFR reference
  source_url             TEXT NOT NULL,
  source_tier             INTEGER NOT NULL,
  last_updated             TEXT NOT NULL
);
CREATE INDEX idx_eccn_code ON eccn_entries(eccn);

CREATE VIRTUAL TABLE eccn_search USING fts5(
  description,
  content='eccn_entries',
  content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2'
);
CREATE TRIGGER eccn_search_ai AFTER INSERT ON eccn_entries BEGIN
  INSERT INTO eccn_search(rowid, description) VALUES (new.id, new.description);
END;
CREATE TRIGGER eccn_search_ad AFTER DELETE ON eccn_entries BEGIN
  INSERT INTO eccn_search(eccn_search, rowid, description) VALUES ('delete', old.id, old.description);
END;
CREATE TRIGGER eccn_search_au AFTER UPDATE ON eccn_entries BEGIN
  INSERT INTO eccn_search(eccn_search, rowid, description) VALUES ('delete', old.id, old.description);
  INSERT INTO eccn_search(rowid, description) VALUES (new.id, new.description);
END;

CREATE TABLE country_chart (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code        TEXT NOT NULL,     -- ISO 3166-1 alpha-2
  country_name        TEXT NOT NULL,
  reason_for_control  TEXT NOT NULL,     -- NS, MT, AT, CB, NP, CC, FC, SI, EI, UN, RS, etc
  control_level       TEXT NOT NULL,     -- e.g. "NS:1", "AT:1"
  source_url          TEXT NOT NULL,
  source_tier         INTEGER NOT NULL,
  last_updated        TEXT NOT NULL,
  UNIQUE (country_code, reason_for_control)
);
CREATE INDEX idx_chart_country ON country_chart(country_code);

-- The full Commerce Country Chart (15 CFR 738 Supp. 1) covers ~180 destinations x
-- up to 8 reason-for-control categories. This app curates a deliberately partial
-- subset (see migration 0005). A destination with zero rows in `country_chart`
-- must NOT be silently treated as "no reason-for-control match" (=> false NLR) --
-- this coverage table lets route logic distinguish "genuinely NLR" from "not yet
-- curated, ask a human." Every country the app can resolve a screening/determination
-- result for must have a row here.
CREATE TABLE country_chart_coverage (
  country_code   TEXT PRIMARY KEY,
  country_name   TEXT NOT NULL,
  status         TEXT NOT NULL,   -- 'curated' (rows in country_chart reflect verified primary-source data)
                                   -- | 'comprehensive_embargo' (EAR Part 746 destination-based embargo, Country Group E -- not plain X marks)
                                   -- | 'broad_restriction_746_5' (EAR 746.5/746.8 near-comprehensive Russia/Belarus restriction, not the standard chart)
                                   -- | 'not_curated' (no verified data -- app must flag for manual review, never default to NLR)
                                   -- A country_code with NO row in this table is implicitly 'not_curated' -- app logic
                                   -- must treat missing-from-this-table identically to an explicit 'not_curated' row.
  notes          TEXT,
  source_url     TEXT NOT NULL,
  source_tier    INTEGER NOT NULL,
  last_updated   TEXT NOT NULL
);

CREATE TABLE tariff_overlays (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  program          TEXT NOT NULL,   -- sec232_steel | sec232_aluminum | sec232_copper | sec232_autos | sec301_china | sec301_forced_labor | sec338_canada
  hts_pattern      TEXT NOT NULL,   -- prefix match against resolved HTS code, e.g. "7208"
  country_scope    TEXT,            -- ISO code, or NULL = all countries
  rate_pct         REAL,
  rate_type        TEXT NOT NULL,   -- ad_valorem | specific | compound
  legal_basis      TEXT NOT NULL,
  effective_date   TEXT NOT NULL,
  expiration_date  TEXT,
  exclusions       TEXT,            -- JSON array of exclusion conditions
  stacking_rule    TEXT,            -- notes on interaction with other overlays
  source_url       TEXT NOT NULL,
  source_tier       INTEGER NOT NULL,
  last_updated       TEXT NOT NULL,
  data_as_of         TEXT NOT NULL    -- drives the UI provenance badge
);
CREATE INDEX idx_overlay_program ON tariff_overlays(program);
CREATE INDEX idx_overlay_hts_pattern ON tariff_overlays(hts_pattern);
