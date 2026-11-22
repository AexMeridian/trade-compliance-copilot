-- Re-tag stored Federal Register actions with the corrected rules in src/lib/pulse/tag.ts (new documents are tagged at ingest).
-- 1. BIS runs Section 232 investigations of imports. Those notices, and their paperwork notices, are tariff actions, not export controls.
-- 2. CBP rules that change what importers and brokers must do at entry (for example "Heightened Requirements for Foreign Importers of
--    Record") were tagged "Other" and so left out of "What matters most".
-- Both are plain text rules on title and abstract, the same as the ingest code; no model call.

UPDATE trade_policy_actions SET tag = 'Tariff'
WHERE tag = 'Export Control'
  AND (title || ' ' || COALESCE(abstract, '')) LIKE '%Section 232%'
  AND (title || ' ' || COALESCE(abstract, '')) NOT LIKE '%Entity List%'
  AND (title || ' ' || COALESCE(abstract, '')) NOT LIKE '%Export Administration Regulations%';

UPDATE trade_policy_actions SET tag = 'Tariff'
WHERE tag = 'Other'
  AND agency LIKE '%Customs and Border%'
  AND (
    (title || ' ' || COALESCE(abstract, '')) LIKE '%importer of record%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%importers of record%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%customs broker%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%informal entry%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%de minimis%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%merchandise processing fee%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%withhold release%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%forced labor%'
    OR (title || ' ' || COALESCE(abstract, '')) LIKE '%drawback%'
  );
