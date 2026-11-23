-- Full Commerce Control List support (loaded by 0072 onwards, built by scripts/build-ccl.ts) and Country Groups (loaded by 0071, built by
-- scripts/build-country-groups.ts).
--
-- eccn_entries gains the published text the app keeps beside its parsed reasons_for_control: the entry title, the Reason for Control rows, the License
-- Exception block and the Related Controls, all as the eCFR prints them (text, not regulatory advice). `origin` says who wrote the row: 'hand_verified'
-- rows (the ten checked against the eCFR by hand in 0032) are never overwritten by the generated load; 'ecfr_parse' rows are replaced wholesale by it.
ALTER TABLE eccn_entries ADD COLUMN origin TEXT;
ALTER TABLE eccn_entries ADD COLUMN title TEXT;
ALTER TABLE eccn_entries ADD COLUMN control_text TEXT;
ALTER TABLE eccn_entries ADD COLUMN license_exceptions_text TEXT;
ALTER TABLE eccn_entries ADD COLUMN related_controls TEXT;
UPDATE eccn_entries SET origin = 'hand_verified' WHERE eccn IN ('3A001', '3A090', '4A003', '4A090', '5A002', '5D002', '5A992', '6A003', '1C350');

-- Country Groups (15 CFR 740 Supp. No. 1): one row per country and group, e.g. ('DE', 'A:1'). Group codes are A:1-A:6, B, D:1-D:5, E:1, E:2.
-- as_of is the eCFR date the text was read at, shown beside the groups on country pages.
CREATE TABLE country_groups (
  country_code  TEXT NOT NULL,
  group_code    TEXT NOT NULL,
  country_name  TEXT NOT NULL,   -- as the eCFR prints it
  source_url    TEXT NOT NULL,
  as_of         TEXT NOT NULL,
  PRIMARY KEY (country_code, group_code)
);
CREATE INDEX idx_country_groups_group ON country_groups(group_code);
