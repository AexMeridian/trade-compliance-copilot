-- Census data that needs the free CENSUS_API_KEY (src/lib/pulse/census.ts). Both tables stay empty until the key is set.
--
-- census_trade: monthly U.S. imports for consumption, Census-calculated duties and exports by partner country (Census USA Trade Online
-- / international trade API, HS-level rows summed to the country). One row per month and Census country code; the pseudo-code 'ALL' is the
-- sum over partners. Upserted only when a value changed, so a daily run that finds nothing new writes nothing.
CREATE TABLE census_trade (
  ym TEXT NOT NULL,           -- 'YYYY-MM'
  cty_code TEXT NOT NULL,     -- Census country code, e.g. '5700' (China); 'ALL' = total over partners
  cty_name TEXT NOT NULL,
  iso2 TEXT,                  -- two-letter code when the name could be matched, else NULL
  imports REAL,               -- CON_VAL_MO: imports for consumption, U.S. dollars
  duties REAL,                -- CAL_DUT_MO: calculated duty, U.S. dollars
  exports REAL,               -- ALL_VAL_MO from the exports endpoint, U.S. dollars
  PRIMARY KEY (ym, cty_code)
);
CREATE INDEX idx_census_trade_iso ON census_trade(iso2, ym);

-- acs_foreign_born: ACS 1-year table B05006 (place of birth for the foreign-born population), one row per country of birth and place
-- (geo 'US' for the nation, otherwise the state name).
CREATE TABLE acs_foreign_born (
  year INTEGER NOT NULL,
  geo TEXT NOT NULL,
  iso2 TEXT NOT NULL,
  estimate INTEGER NOT NULL,
  PRIMARY KEY (geo, iso2)
);
CREATE INDEX idx_acs_foreign_born_iso ON acs_foreign_born(iso2, estimate DESC);
