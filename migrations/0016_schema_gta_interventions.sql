-- Global Trade Alert (globaltradealert.org) intervention records: foreign
-- governments' own trade-restrictive/retaliatory measures affecting the
-- United States. This is independent (University of St. Gallen-affiliated)
-- research data, free for non-commercial use (CC BY-NC 4.0) -- NOT a U.S.
-- government source like every other table in this app, and every surface
-- that reads this table discloses that distinction.
--
-- Full DELETE + reinsert on each refresh, same reasoning as csl_entries
-- (migrations/0001): GTA itself revises and revokes records over time, so an
-- incremental/append-only table here would risk reporting a measure as still
-- in force after GTA has recorded its removal.
CREATE TABLE gta_interventions (
  intervention_id INTEGER PRIMARY KEY,
  state_act_title TEXT NOT NULL,
  intervention_url TEXT NOT NULL,
  state_act_url TEXT NOT NULL,
  gta_evaluation TEXT NOT NULL, -- 'Red' | 'Amber' | 'Green' (this app only ever ingests Red/Amber -- see src/lib/pulse/globalTradeAlert.ts)
  implementing_jurisdictions TEXT NOT NULL, -- JSON array of {id, name, iso} -- GTA's own jurisdiction records
  implementing_jurisdiction_groups TEXT, -- JSON array of {name} (e.g. "European Union"), NULL if the measure wasn't implemented at a bloc level
  intervention_type TEXT NOT NULL,
  mast_chapter TEXT NOT NULL,
  date_announced TEXT,
  date_implemented TEXT,
  date_removed TEXT,
  is_in_force INTEGER NOT NULL,
  last_synced_at TEXT NOT NULL
);
CREATE INDEX idx_gta_date_announced ON gta_interventions(date_announced DESC);
