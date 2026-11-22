-- Removes the one empty draft case a simulated user-testing visitor created on 2026-11-22 by clicking "Start an import case" (no product was
-- classified and no model was called). Limited to that id prefix, non-sample, still a draft. Drafts also expire on their own after 30 days.
DELETE FROM case_events WHERE case_id IN (SELECT id FROM cases WHERE id LIKE '12af4d21-%' AND is_sample = 0 AND status = 'draft');
DELETE FROM cases WHERE id LIKE '12af4d21-%' AND is_sample = 0 AND status = 'draft';
