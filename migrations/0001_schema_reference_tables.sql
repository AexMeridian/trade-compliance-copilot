-- Reference data tables: HTS (import classification), Schedule B (export classification),
-- their cross-reference, and the two denied/sanctioned-party screening lists.
-- All bulk data for these tables is loaded separately via scripts/ (see scripts/refresh_data.md),
-- NOT via migrations -- this file only creates schema.

CREATE TABLE hts_lines (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  htsno         TEXT NOT NULL,
  indent        INTEGER NOT NULL,
  description   TEXT NOT NULL,
  superior_id   INTEGER REFERENCES hts_lines(id),
  units         TEXT,                 -- JSON array, e.g. ["No.","kg"]
  general_rate  TEXT,                 -- Column 1 General, raw string ("Free", "2.5%", "9.1cents/kg")
  special_rate  TEXT,                 -- Special program rates, raw string incl. program symbols
  other_rate    TEXT,                 -- Column 2
  footnotes     TEXT,                 -- JSON array
  chapter       TEXT NOT NULL,
  revision      TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  source_tier   INTEGER NOT NULL,
  last_updated  TEXT NOT NULL
);
CREATE INDEX idx_hts_htsno ON hts_lines(htsno);
CREATE INDEX idx_hts_chapter ON hts_lines(chapter);

CREATE TABLE schedule_b_lines (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL,
  indent        INTEGER NOT NULL,
  description   TEXT NOT NULL,
  superior_id   INTEGER REFERENCES schedule_b_lines(id),
  units         TEXT,
  hs6           TEXT NOT NULL,
  chapter       TEXT NOT NULL,
  edition       TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  source_tier   INTEGER NOT NULL,
  last_updated  TEXT NOT NULL
);
CREATE INDEX idx_sb_code ON schedule_b_lines(code);
CREATE INDEX idx_sb_chapter ON schedule_b_lines(chapter);
CREATE INDEX idx_sb_hs6 ON schedule_b_lines(hs6);

CREATE TABLE hts_schedule_b_xref (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  hts_htsno         TEXT NOT NULL,
  schedule_b_code   TEXT NOT NULL,
  hs6               TEXT NOT NULL
);
CREATE INDEX idx_xref_hts ON hts_schedule_b_xref(hts_htsno);
CREATE INDEX idx_xref_sb ON hts_schedule_b_xref(schedule_b_code);
CREATE INDEX idx_xref_hs6 ON hts_schedule_b_xref(hs6);

CREATE TABLE sdn_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uid             TEXT NOT NULL UNIQUE,   -- OFAC ent_num
  primary_name    TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  entity_type     TEXT,                   -- individual/entity/vessel/aircraft
  programs        TEXT,                   -- JSON array of program tags
  dob             TEXT,
  place_of_birth  TEXT,
  addresses       TEXT,                   -- JSON array of {address, city, country}
  remarks         TEXT,
  source_url      TEXT NOT NULL,
  source_tier     INTEGER NOT NULL,
  last_updated    TEXT NOT NULL
);
CREATE INDEX idx_sdn_name_norm ON sdn_entries(name_normalized);

CREATE TABLE sdn_aliases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sdn_id            INTEGER NOT NULL REFERENCES sdn_entries(id),
  alias             TEXT NOT NULL,
  alias_normalized  TEXT NOT NULL,
  alias_type        TEXT                  -- aka/fka/nka/weak alias
);
CREATE INDEX idx_sdn_alias_sdn ON sdn_aliases(sdn_id);
CREATE INDEX idx_sdn_alias_norm ON sdn_aliases(alias_normalized);

CREATE TABLE csl_entries (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  source_list               TEXT NOT NULL,  -- CSL "source" column: Entity List / Denied Persons List / etc
  name                      TEXT NOT NULL,
  name_normalized           TEXT NOT NULL,
  addresses                 TEXT,
  federal_register_notice   TEXT,
  license_requirement       TEXT,
  license_policy            TEXT,
  start_date                TEXT,
  source_url                TEXT NOT NULL,
  source_tier                INTEGER NOT NULL,
  last_updated               TEXT NOT NULL
);
CREATE INDEX idx_csl_name_norm ON csl_entries(name_normalized);
CREATE INDEX idx_csl_source_list ON csl_entries(source_list);

CREATE TABLE csl_aliases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  csl_id            INTEGER NOT NULL REFERENCES csl_entries(id),
  alias             TEXT NOT NULL,
  alias_normalized  TEXT NOT NULL
);
CREATE INDEX idx_csl_alias_csl ON csl_aliases(csl_id);
CREATE INDEX idx_csl_alias_norm ON csl_aliases(alias_normalized);
