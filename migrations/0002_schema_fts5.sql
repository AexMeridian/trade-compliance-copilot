-- FTS5 full-text search over classification and party-name tables, external-content
-- pattern (index references the base table's rowid rather than duplicating the text).
-- Triggers keep each FTS index in sync with its base table on INSERT/UPDATE/DELETE.

CREATE VIRTUAL TABLE hts_search USING fts5(
  description,
  content='hts_lines',
  content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2'
);
CREATE TRIGGER hts_search_ai AFTER INSERT ON hts_lines BEGIN
  INSERT INTO hts_search(rowid, description) VALUES (new.id, new.description);
END;
CREATE TRIGGER hts_search_ad AFTER DELETE ON hts_lines BEGIN
  INSERT INTO hts_search(hts_search, rowid, description) VALUES ('delete', old.id, old.description);
END;
CREATE TRIGGER hts_search_au AFTER UPDATE ON hts_lines BEGIN
  INSERT INTO hts_search(hts_search, rowid, description) VALUES ('delete', old.id, old.description);
  INSERT INTO hts_search(rowid, description) VALUES (new.id, new.description);
END;

CREATE VIRTUAL TABLE schedule_b_search USING fts5(
  description,
  content='schedule_b_lines',
  content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2'
);
CREATE TRIGGER sb_search_ai AFTER INSERT ON schedule_b_lines BEGIN
  INSERT INTO schedule_b_search(rowid, description) VALUES (new.id, new.description);
END;
CREATE TRIGGER sb_search_ad AFTER DELETE ON schedule_b_lines BEGIN
  INSERT INTO schedule_b_search(schedule_b_search, rowid, description) VALUES ('delete', old.id, old.description);
END;
CREATE TRIGGER sb_search_au AFTER UPDATE ON schedule_b_lines BEGIN
  INSERT INTO schedule_b_search(schedule_b_search, rowid, description) VALUES ('delete', old.id, old.description);
  INSERT INTO schedule_b_search(rowid, description) VALUES (new.id, new.description);
END;

-- eccn_search is created in 0003, after eccn_entries (its content table) exists.

CREATE VIRTUAL TABLE sdn_name_search USING fts5(
  name_normalized,
  content='sdn_entries',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER sdn_search_ai AFTER INSERT ON sdn_entries BEGIN
  INSERT INTO sdn_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;
CREATE TRIGGER sdn_search_ad AFTER DELETE ON sdn_entries BEGIN
  INSERT INTO sdn_name_search(sdn_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
END;
CREATE TRIGGER sdn_search_au AFTER UPDATE ON sdn_entries BEGIN
  INSERT INTO sdn_name_search(sdn_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
  INSERT INTO sdn_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;

CREATE VIRTUAL TABLE sdn_alias_search USING fts5(
  alias_normalized,
  content='sdn_aliases',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER sdn_alias_search_ai AFTER INSERT ON sdn_aliases BEGIN
  INSERT INTO sdn_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
CREATE TRIGGER sdn_alias_search_ad AFTER DELETE ON sdn_aliases BEGIN
  INSERT INTO sdn_alias_search(sdn_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
END;
CREATE TRIGGER sdn_alias_search_au AFTER UPDATE ON sdn_aliases BEGIN
  INSERT INTO sdn_alias_search(sdn_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
  INSERT INTO sdn_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;

CREATE VIRTUAL TABLE csl_name_search USING fts5(
  name_normalized,
  content='csl_entries',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER csl_search_ai AFTER INSERT ON csl_entries BEGIN
  INSERT INTO csl_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;
CREATE TRIGGER csl_search_ad AFTER DELETE ON csl_entries BEGIN
  INSERT INTO csl_name_search(csl_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
END;
CREATE TRIGGER csl_search_au AFTER UPDATE ON csl_entries BEGIN
  INSERT INTO csl_name_search(csl_name_search, rowid, name_normalized) VALUES ('delete', old.id, old.name_normalized);
  INSERT INTO csl_name_search(rowid, name_normalized) VALUES (new.id, new.name_normalized);
END;

CREATE VIRTUAL TABLE csl_alias_search USING fts5(
  alias_normalized,
  content='csl_aliases',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER csl_alias_search_ai AFTER INSERT ON csl_aliases BEGIN
  INSERT INTO csl_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
CREATE TRIGGER csl_alias_search_ad AFTER DELETE ON csl_aliases BEGIN
  INSERT INTO csl_alias_search(csl_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
END;
CREATE TRIGGER csl_alias_search_au AFTER UPDATE ON csl_aliases BEGIN
  INSERT INTO csl_alias_search(csl_alias_search, rowid, alias_normalized) VALUES ('delete', old.id, old.alias_normalized);
  INSERT INTO csl_alias_search(rowid, alias_normalized) VALUES (new.id, new.alias_normalized);
END;
