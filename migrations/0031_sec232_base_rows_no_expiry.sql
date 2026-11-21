-- The base Section 232 steel, aluminum and copper rows (50%) were seeded in 0007 with expiration_date 2027-12-31. Only the reduced 15%
-- transitional categories and the per-country caps run to that date under Proclamation 11032; the 50% base action has no end date. Left as
-- seeded, the calculator would treat the base action as expired from 2028-01-01 and silently drop 50% from the total.
-- This clears the end date on the three base rows only. The country-cap rows (sec232_metals_country_cap) keep theirs. Rate, scope and
-- sources are unchanged.
UPDATE tariff_overlays
SET expiration_date = NULL
WHERE program IN ('sec232_steel', 'sec232_aluminum', 'sec232_copper')
  AND country_scope IS NULL
  AND expiration_date = '2027-12-31';
