-- UK Sanctions List (OFSI's consolidated list, sanctionslist.fcdo.gov.uk) --
-- a separate feed from the UN list and OFAC/CSL, mirroring csl_entries'
-- shape + FTS5 pattern (0001/0002). The feed is a flat list of name
-- variants grouped by UKSanctionsListRef (one "Primary name" row per
-- designation plus AKA/FKA/"Primary name variation" rows) -- the refresh job
-- collapses each group into one uk_sanctions_entries row + N aliases.

CREATE TABLE uk_sanctions_entries (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  uid                     TEXT NOT NULL UNIQUE,  -- feed's UKSanctionsListRef, e.g. "GHR0086"
  group_id                TEXT,                  -- feed's numeric GroupID (OFSI internal, informational only)
  entity_type             TEXT NOT NULL,         -- Individual / Entity / Ship
  primary_name            TEXT NOT NULL,
  name_normalized         TEXT NOT NULL,
  regime_name             TEXT,                  -- e.g. "Russia", "Global Human Rights"
  listing_type            TEXT,                  -- UK / UN / "UK and UN" -- informational, not an exclusion filter
  date_listed             TEXT,
  addresses               TEXT,                  -- semicolon-joined, human-readable (mirrors
                                                  -- csl_entries' plain-string choice -- the
                                                  -- screening prompt inserts this verbatim)
  statement_of_reasons    TEXT,
  source_url              TEXT NOT NULL,
  source_tier             INTEGER NOT NULL,
  last_updated            TEXT NOT NULL
);
CREATE INDEX idx_uk_name_norm ON uk_sanctions_entries(name_normalized);
CREATE INDEX idx_uk_regime ON uk_sanctions_entries(regime_name);

CREATE TABLE uk_sanctions_aliases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uk_id             INTEGER NOT NULL REFERENCES uk_sanctions_entries(id),
  alias             TEXT NOT NULL,
  alias_normalized  TEXT NOT NULL,
  alias_type        TEXT                   -- AKA / FKA / Primary name variation
);
CREATE INDEX idx_uk_alias_uk ON uk_sanctions_aliases(uk_id);
CREATE INDEX idx_uk_alias_norm ON uk_sanctions_aliases(alias_normalized);

CREATE VIRTUAL TABLE uk_name_search USING fts5(
  name_normalized,
  content='uk_sanctions_entries',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER uk_search_ai AFTER INSERT ON uk_sanctions_entries BEGIN
  INSERT INTO uk_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;
CREATE TRIGGER uk_search_ad AFTER DELETE ON uk_sanctions_entries BEGIN
  INSERT INTO uk_name_search(uk_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
END;
CREATE TRIGGER uk_search_au AFTER UPDATE ON uk_sanctions_entries BEGIN
  INSERT INTO uk_name_search(uk_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
  INSERT INTO uk_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;

CREATE VIRTUAL TABLE uk_alias_search USING fts5(
  alias_normalized,
  content='uk_sanctions_aliases',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER uk_alias_search_ai AFTER INSERT ON uk_sanctions_aliases BEGIN
  INSERT INTO uk_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
CREATE TRIGGER uk_alias_search_ad AFTER DELETE ON uk_sanctions_aliases BEGIN
  INSERT INTO uk_alias_search(uk_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
END;
CREATE TRIGGER uk_alias_search_au AFTER UPDATE ON uk_sanctions_aliases BEGIN
  INSERT INTO uk_alias_search(uk_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
  INSERT INTO uk_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
