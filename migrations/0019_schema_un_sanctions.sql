-- UN Security Council Consolidated Sanctions List (scsanctions.un.org) -- a
-- separate feed from OFAC's SDN list and trade.gov's CSL, mirroring
-- csl_entries' shape + FTS5 pattern (0001/0002) since it can't be tagged
-- into either existing table. One row per listed individual/entity; the
-- feed's INDIVIDUAL_ALIAS/ENTITY_ALIAS entries become un_sanctions_aliases.

CREATE TABLE un_sanctions_entries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uid               TEXT NOT NULL UNIQUE,  -- feed's DATAID
  entity_type       TEXT NOT NULL,         -- individual / entity
  primary_name      TEXT NOT NULL,
  name_normalized   TEXT NOT NULL,
  un_list_type      TEXT,                  -- sanctions committee, e.g. "Al-Qaida", "Taliban", "DPRK"
  reference_number  TEXT,                  -- e.g. "QDi.001"
  listed_on         TEXT,
  nationality       TEXT,                  -- comma-joined country names, human-readable
  addresses         TEXT,                  -- semicolon-joined, human-readable (mirrors csl_entries'
                                            -- plain-string choice -- the screening prompt inserts
                                            -- this verbatim, not a JSON blob)
  remarks           TEXT,                  -- feed's COMMENTS1
  source_url        TEXT NOT NULL,
  source_tier       INTEGER NOT NULL,
  last_updated      TEXT NOT NULL
);
CREATE INDEX idx_un_name_norm ON un_sanctions_entries(name_normalized);
CREATE INDEX idx_un_list_type ON un_sanctions_entries(un_list_type);

CREATE TABLE un_sanctions_aliases (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  un_id             INTEGER NOT NULL REFERENCES un_sanctions_entries(id),
  alias             TEXT NOT NULL,
  alias_normalized  TEXT NOT NULL,
  alias_type        TEXT                   -- a.k.a. / f.k.a.
);
CREATE INDEX idx_un_alias_un ON un_sanctions_aliases(un_id);
CREATE INDEX idx_un_alias_norm ON un_sanctions_aliases(alias_normalized);

CREATE VIRTUAL TABLE un_name_search USING fts5(
  name_normalized,
  content='un_sanctions_entries',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER un_search_ai AFTER INSERT ON un_sanctions_entries BEGIN
  INSERT INTO un_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;
CREATE TRIGGER un_search_ad AFTER DELETE ON un_sanctions_entries BEGIN
  INSERT INTO un_name_search(un_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
END;
CREATE TRIGGER un_search_au AFTER UPDATE ON un_sanctions_entries BEGIN
  INSERT INTO un_name_search(un_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
  INSERT INTO un_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;

CREATE VIRTUAL TABLE un_alias_search USING fts5(
  alias_normalized,
  content='un_sanctions_aliases',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER un_alias_search_ai AFTER INSERT ON un_sanctions_aliases BEGIN
  INSERT INTO un_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
CREATE TRIGGER un_alias_search_ad AFTER DELETE ON un_sanctions_aliases BEGIN
  INSERT INTO un_alias_search(un_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
END;
CREATE TRIGGER un_alias_search_au AFTER UPDATE ON un_sanctions_aliases BEGIN
  INSERT INTO un_alias_search(un_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
  INSERT INTO un_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
