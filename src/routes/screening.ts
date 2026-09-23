import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { getCaseFile, saveCaseFile, logCaseEvent } from '../lib/caseStore.js';
import { searchPartyCandidates, getSdnEntry, getCslEntry } from '../lib/db.js';
import { rankCandidates } from '../lib/fuzzyMatch.js';
import { callClaudeTool, ClaudeGroundingError } from '../lib/anthropic.js';
import {
  SCREENING_SYSTEM_PROMPT,
  buildScreeningUserContent,
  buildScreeningTool,
  type ScreeningCandidateForPrompt,
  type ScreeningToolOutput,
} from '../prompts/screening.js';
import type { PartyMatch, PartyRole, PartyScreeningResult } from '../types/case.js';

export const screeningRoute = new Hono<{ Bindings: Env }>();

const HARD_STOP_SOURCE_LISTS = new Set(['Entity List (EL) - Bureau of Industry and Security', 'Denied Persons List (DPL) - Bureau of Industry and Security']);

screeningRoute.post('/:id/screening', async (c) => {
  const caseId = c.req.param('id');
  const caseFile = await getCaseFile(c.env, caseId);
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);

  const body = await c.req.json<{ parties: { role: PartyRole; name: string }[] }>();
  const partyResults: PartyScreeningResult[] = [];

  for (const party of body.parties) {
    const rawCandidates = await searchPartyCandidates(c.env, party.name);
    await logCaseEvent(c.env, caseId, 'screening', 'candidate_set', { party: party.name, rawCandidates });

    // Dedupe by (source, entity_id), keeping the highest-scoring name match per entity.
    const dedupedMap = new Map<string, { source: 'SDN' | 'CSL'; entity_id: number; name: string; matched_via: 'primary_name' | 'alias' }>();
    for (const cand of rawCandidates) {
      const key = `${cand.source}:${cand.entity_id}`;
      const existing = dedupedMap.get(key);
      // Prefer primary_name matches for display, but keep whichever the fuzzy ranker will score higher --
      // both are cheap here so just keep primary_name if present, else the first alias seen.
      if (!existing || (existing.matched_via === 'alias' && cand.matched_via === 'primary_name')) {
        dedupedMap.set(key, cand);
      }
    }
    const deduped = [...dedupedMap.values()];

    const ranked = rankCandidates(party.name, deduped, { limit: 5, minScore: 0.55 });

    if (ranked.length === 0) {
      partyResults.push({ role: party.role, input_name: party.name, matches: [] });
      continue;
    }

    // Fetch full entity detail for prompt context and final persistence.
    const enriched: (ScreeningCandidateForPrompt & { entity_id: number; source: 'SDN' | 'CSL'; matched_name: string })[] = [];
    for (const [i, r] of ranked.entries()) {
      const ref = `C${i}`;
      if (r.candidate.source === 'SDN') {
        const entry = await getSdnEntry(c.env, r.candidate.entity_id);
        enriched.push({
          candidate_ref: ref,
          source: 'SDN',
          entity_id: r.candidate.entity_id,
          matched_name: r.candidate.name,
          match_score: r.score.score,
          matched_via: r.candidate.matched_via,
          entity_type_or_source_list: entry?.entity_type ?? null,
          dob: entry?.dob ?? null,
          addresses: entry?.addresses ?? null,
          programs_or_remarks: [entry?.programs, entry?.remarks].filter(Boolean).join(' | ') || null,
        });
      } else {
        const entry = await getCslEntry(c.env, r.candidate.entity_id);
        enriched.push({
          candidate_ref: ref,
          source: 'CSL',
          entity_id: r.candidate.entity_id,
          matched_name: r.candidate.name,
          match_score: r.score.score,
          matched_via: r.candidate.matched_via,
          entity_type_or_source_list: entry?.source_list ?? null,
          dob: null,
          addresses: entry?.addresses ?? null,
          programs_or_remarks: [entry?.license_requirement, entry?.federal_register_notice].filter(Boolean).join(' | ') || null,
        });
      }
    }

    let output: ScreeningToolOutput;
    try {
      output = await callClaudeTool<ScreeningToolOutput>(c.env, {
        system: SCREENING_SYSTEM_PROMPT,
        userContent: buildScreeningUserContent(party.name, party.role, enriched),
        tool: buildScreeningTool(enriched.map((e) => e.candidate_ref)),
      });
    } catch (err) {
      if (err instanceof ClaudeGroundingError) return c.json({ error: `Screening engine error: ${err.message}` }, 502);
      throw err;
    }

    const assessmentByRef = new Map(output.assessments.map((a) => [a.candidate_ref, a]));
    const matches: PartyMatch[] = enriched.map((e) => {
      const assessment = assessmentByRef.get(e.candidate_ref);
      return {
        matched_entity_id: e.entity_id,
        matched_list: e.source === 'SDN' ? 'SDN' : e.entity_type_or_source_list ?? 'CSL',
        matched_name: e.matched_name,
        match_score: e.match_score,
        matched_fields: assessment?.matched_fields ?? [],
        verdict: assessment?.verdict ?? 'inconclusive',
        risk_memo: assessment?.risk_memo ?? 'Model did not return an assessment for this candidate; treat as inconclusive pending manual review.',
      };
    });

    partyResults.push({ role: party.role, input_name: party.name, matches });
    await logCaseEvent(c.env, caseId, 'screening', 'claude_response', { party: party.name, output });
  }

  const trueMatches = partyResults.flatMap((p) => p.matches.filter((m) => m.verdict === 'true_match'));
  const hardStopHit = trueMatches.some((m) => HARD_STOP_SOURCE_LISTS.has(m.matched_list));
  const anyInconclusive = partyResults.some((p) => p.matches.some((m) => m.verdict === 'inconclusive'));

  // Import: a true Entity List/Denied Persons hit is a strong caution, not automatically
  // determinative (BIS Entity List is primarily an export control). Export: it's a hard stop.
  const isHardStop = caseFile.direction === 'export' && hardStopHit;
  const severity: 'none' | 'caution' | 'hard_stop' = isHardStop
    ? 'hard_stop'
    : trueMatches.length > 0 || anyInconclusive
      ? 'caution'
      : 'none';

  caseFile.screening = {
    status: 'complete',
    parties: partyResults,
    highest_severity: severity,
    hard_stop_triggered: isHardStop,
  };

  if (hardStopHit && caseFile.direction === 'import') {
    caseFile.open_issues.push(
      'Screening: a true match against the BIS Entity List/Denied Persons List was found. This list is primarily an export control, but still warrants compliance review for an import transaction (e.g. related-party or reexport risk).'
    );
  }
  if (isHardStop) {
    caseFile.open_issues.push('Screening: HARD STOP -- true match against BIS Entity List/Denied Persons List on an export transaction. License-determinative; see Module 4.');
  }

  await saveCaseFile(c.env, caseFile);
  return c.json({ screening: caseFile.screening });
});
