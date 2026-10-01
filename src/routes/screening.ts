import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { getCaseFile, saveCaseFile, logCaseEvent } from '../lib/caseStore.js';
import { searchPartyCandidates, getSdnEntry, getCslEntry, getUnEntry, getUkEntry } from '../lib/db.js';
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

// Substring match against the CSL's source_list text, not an exact-string
// Set: that text is loaded verbatim from trade.gov's own CSV column
// (scripts/fetch-csl.ts) with no normalization, so any minor formatting
// change there (punctuation, abbreviation, bureau-name suffix) would make an
// exact match silently stop firing on a genuine hit. "Entity List" and
// "Denied Persons List" are distinctive enough phrases that a substring match
// stays precise.
const HARD_STOP_LIST_FRAGMENTS = ['Entity List', 'Denied Persons List'];

// The BIS Military End User (MEU) List is an end-use/end-user control, not a
// denied-party list -- a true match means additional license requirements can
// apply, not an automatic denial, so it's called out with its own message
// rather than folded into the Entity List/DPL hard-stop/caution language
// above. Already fully present in csl_entries.source_list (bundled into
// trade.gov's own CSL CSV) -- no new ingestion needed, just this check.
const MEU_LIST_FRAGMENT = 'Military End User';

screeningRoute.post('/:id/screening', async (c) => {
  const caseId = c.req.param('id');
  const caseFile = await getCaseFile(c.env, caseId);
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);

  const body = await c.req
    .json<{ parties?: { role: PartyRole; name: string }[]; deemed_export_flag?: boolean }>()
    .catch(() => ({}) as { parties?: { role: PartyRole; name: string }[]; deemed_export_flag?: boolean });
  if (!Array.isArray(body.parties) || body.parties.length === 0) {
    return c.json({ error: 'At least one party ({ role, name }) is required to run screening.' }, 400);
  }
  const partyResults: PartyScreeningResult[] = [];

  for (const party of body.parties) {
    const rawCandidates = await searchPartyCandidates(c.env, party.name);
    await logCaseEvent(c.env, caseId, 'screening', 'candidate_set', { party: party.name, rawCandidates });

    // Dedupe by (source, entity_id), keeping the highest-scoring name match per entity.
    const dedupedMap = new Map<string, { source: 'SDN' | 'CSL' | 'UN' | 'UK'; entity_id: number; name: string; matched_via: 'primary_name' | 'alias' }>();
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

    // Fetch full entity detail for prompt context and final persistence. Each
    // candidate's lookup is independent, so run them concurrently instead of
    // one D1 round trip at a time.
    const enriched = await Promise.all(
      ranked.map(
        async (
          r,
          i
        ): Promise<
          ScreeningCandidateForPrompt & {
            entity_id: number;
            source: 'SDN' | 'CSL' | 'UN' | 'UK';
            matched_name: string;
            token_sort_score: number;
            jaro_winkler_score: number;
          }
        > => {
          const ref = `C${i}`;
          if (r.candidate.source === 'SDN') {
            const entry = await getSdnEntry(c.env, r.candidate.entity_id);
            return {
              candidate_ref: ref,
              source: 'SDN',
              entity_id: r.candidate.entity_id,
              matched_name: r.candidate.name,
              match_score: r.score.score,
              matched_via: r.candidate.matched_via,
              token_sort_score: r.score.tokenSortScore,
              jaro_winkler_score: r.score.jaroWinklerScore,
              entity_type_or_source_list: entry?.entity_type ?? null,
              dob: entry?.dob ?? null,
              addresses: entry?.addresses ?? null,
              programs_or_remarks: [entry?.programs, entry?.remarks].filter(Boolean).join(' | ') || null,
            };
          }
          if (r.candidate.source === 'CSL') {
            const entry = await getCslEntry(c.env, r.candidate.entity_id);
            return {
              candidate_ref: ref,
              source: 'CSL',
              entity_id: r.candidate.entity_id,
              matched_name: r.candidate.name,
              match_score: r.score.score,
              matched_via: r.candidate.matched_via,
              token_sort_score: r.score.tokenSortScore,
              jaro_winkler_score: r.score.jaroWinklerScore,
              entity_type_or_source_list: entry?.source_list ?? null,
              dob: null,
              addresses: entry?.addresses ?? null,
              programs_or_remarks: [entry?.license_requirement, entry?.federal_register_notice].filter(Boolean).join(' | ') || null,
            };
          }
          if (r.candidate.source === 'UN') {
            const entry = await getUnEntry(c.env, r.candidate.entity_id);
            return {
              candidate_ref: ref,
              source: 'UN',
              entity_id: r.candidate.entity_id,
              matched_name: r.candidate.name,
              match_score: r.score.score,
              matched_via: r.candidate.matched_via,
              token_sort_score: r.score.tokenSortScore,
              jaro_winkler_score: r.score.jaroWinklerScore,
              entity_type_or_source_list: entry?.un_list_type ?? null,
              dob: null,
              addresses: entry?.addresses ?? null,
              programs_or_remarks: [entry?.remarks, entry?.reference_number ? `UN ref ${entry.reference_number}` : null].filter(Boolean).join(' | ') || null,
            };
          }
          const entry = await getUkEntry(c.env, r.candidate.entity_id);
          return {
            candidate_ref: ref,
            source: 'UK',
            entity_id: r.candidate.entity_id,
            matched_name: r.candidate.name,
            match_score: r.score.score,
            matched_via: r.candidate.matched_via,
            token_sort_score: r.score.tokenSortScore,
            jaro_winkler_score: r.score.jaroWinklerScore,
            entity_type_or_source_list: entry?.regime_name ?? null,
            dob: null,
            addresses: entry?.addresses ?? null,
            programs_or_remarks: [entry?.statement_of_reasons, entry?.listing_type ? `UK listing type: ${entry.listing_type}` : null].filter(Boolean).join(' | ') || null,
          };
        }
      )
    );

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
      const matchedList =
        e.source === 'SDN'
          ? 'SDN'
          : e.source === 'CSL'
            ? (e.entity_type_or_source_list ?? 'CSL')
            : e.source === 'UN'
              ? `UN Security Council (${e.entity_type_or_source_list ?? 'Consolidated List'})`
              : `UK Sanctions List (${e.entity_type_or_source_list ?? 'OFSI'})`;
      return {
        matched_entity_id: e.entity_id,
        source: e.source,
        matched_list: matchedList,
        matched_name: e.matched_name,
        match_score: e.match_score,
        token_sort_score: e.token_sort_score,
        jaro_winkler_score: e.jaro_winkler_score,
        matched_via: e.matched_via,
        matched_fields: assessment?.matched_fields ?? [],
        verdict: assessment?.verdict ?? 'inconclusive',
        risk_memo: assessment?.risk_memo ?? 'Model did not return an assessment for this candidate; treat as inconclusive pending manual review.',
      };
    });

    partyResults.push({ role: party.role, input_name: party.name, matches });
    await logCaseEvent(c.env, caseId, 'screening', 'claude_response', { party: party.name, output });
  }

  const trueMatches = partyResults.flatMap((p) => p.matches.filter((m) => m.verdict === 'true_match'));
  const hardStopHit = trueMatches.some((m) => HARD_STOP_LIST_FRAGMENTS.some((f) => m.matched_list.includes(f)));
  const meuHit = trueMatches.some((m) => m.matched_list.includes(MEU_LIST_FRAGMENT));
  // UN Security Council designation: treated as a hard stop on export, the same
  // severity tier as the BIS Entity List/Denied Persons List above -- a UN
  // asset-freeze/travel-ban/arms-embargo listing is a comparably binding
  // multilateral sanction, not a softer signal. UK Sanctions List is more
  // heterogeneous (it bundles several distinct UK sanctions regimes with
  // different legal effects), so a true match there is its own caution tier
  // rather than a hard stop, mirroring the MEU List's treatment below.
  const unHit = trueMatches.some((m) => m.source === 'UN');
  const ukHit = trueMatches.some((m) => m.source === 'UK');
  const anyInconclusive = partyResults.some((p) => p.matches.some((m) => m.verdict === 'inconclusive'));

  // Import: a true Entity List/Denied Persons/UN hit is a strong caution, not automatically
  // determinative (these are primarily export controls / multilateral sanctions). Export: hard stop.
  const isHardStop = caseFile.direction === 'export' && (hardStopHit || unHit);
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
    screened_at: new Date().toISOString(),
    deemed_export_flagged: body.deemed_export_flag === true,
  };

  if (hardStopHit && caseFile.direction === 'import') {
    caseFile.open_issues.push(
      'Screening: a true match against the BIS Entity List/Denied Persons List was found. This list is primarily an export control, but still warrants compliance review for an import transaction (e.g. related-party or reexport risk).'
    );
  }
  if (hardStopHit && isHardStop) {
    caseFile.open_issues.push('Screening: HARD STOP -- true match against BIS Entity List/Denied Persons List on an export transaction. License-determinative; see Module 4.');
  }
  if (unHit && caseFile.direction === 'import') {
    caseFile.open_issues.push(
      'Screening: a true match against the UN Security Council Consolidated Sanctions List was found. UN sanctions are typically implemented domestically through other listings (e.g. OFAC SDN), but this still warrants compliance review for an import transaction (e.g. related-party or reexport risk).'
    );
  }
  if (unHit && isHardStop) {
    caseFile.open_issues.push(
      'Screening: HARD STOP -- true match against the UN Security Council Consolidated Sanctions List on an export transaction. A UN Security Council designation (asset freeze, travel ban, or arms embargo) is treated with the same severity as a BIS Entity List/Denied Persons List hit; see Module 4.'
    );
  }
  if (ukHit) {
    caseFile.open_issues.push(
      'Screening: a true match against the UK Sanctions List (OFSI) was found. The UK list spans several distinct sanctions regimes with different legal effects, so this is flagged as a caution rather than an automatic hard stop -- confirm which regime applies and whether it affects this specific transaction before proceeding.'
    );
  }
  if (meuHit) {
    caseFile.open_issues.push(
      'Screening: a true match against the BIS Military End User (MEU) List was found. This is an end-use/end-user control, not a denied-party hard stop -- it means additional license requirements can apply to this party for certain items, distinct from any Entity List/Denied Persons List finding above.'
    );
  }
  if (anyInconclusive && !hardStopHit && !unHit && !ukHit && !meuHit) {
    caseFile.open_issues.push(
      'Screening: at least one party has a fuzzy-match candidate scored too close to call (see the match-score breakdown above). Next step: confirm the party\'s full legal name, address and any other identifiers, then re-screen -- do not treat an inconclusive match as cleared.'
    );
  }
  if (body.deemed_export_flag === true) {
    caseFile.open_issues.push(
      'Screening: this transaction may involve sharing controlled technology or source code with a foreign national employee or contractor -- that counts as an export under the EAR/ITAR ("deemed export") even if nothing physically crosses a border. Confirm the foreign national’s country of nationality is checked against the same license-requirement logic as the physical destination before relying on this determination.'
    );
  }

  await saveCaseFile(c.env, caseFile);
  return c.json({ screening: caseFile.screening });
});
