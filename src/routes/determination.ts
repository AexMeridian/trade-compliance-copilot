import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { getCaseFile, saveCaseFile, logCaseEvent } from '../lib/caseStore.js';
import { getRateBearingHtsLine, getApplicableOverlays, searchEccn, getEccnByCode, getCountryCoverage, getCountryChartRows } from '../lib/db.js';
import { buildDutyStack } from '../lib/dutyStack.js';
import { callClaudeTool, ClaudeGroundingError } from '../lib/anthropic.js';
import {
  IMPORT_NARRATION_SYSTEM_PROMPT,
  buildImportNarrationUserContent,
  buildImportNarrationTool,
  type ImportNarrationOutput,
  EXPORT_ECCN_SYSTEM_PROMPT,
  buildExportEccnUserContent,
  buildExportEccnTool,
  type ExportEccnOutput,
} from '../prompts/determination.js';
import type { Verdict } from '../types/case.js';

export const determinationRoute = new Hono<{ Bindings: Env }>();

determinationRoute.post('/:id/determination', async (c) => {
  const caseId = c.req.param('id');
  const caseFile = await getCaseFile(c.env, caseId);
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);
  if (caseFile.classification.status !== 'complete' || caseFile.origin.status !== 'complete' || caseFile.screening.status !== 'complete') {
    return c.json({ error: 'Modules 1-3 (classification, origin, screening) must be complete before Module 4 (determination).' }, 409);
  }

  const code = caseFile.classification.selected_code!;

  if (caseFile.direction === 'import') {
    // Import: country of origin (where the good was made) drives both USMCA
    // eligibility and the 232/301/338 overlay lookups -- Module 2's
    // final_assembly_country is the right field for this.
    const country = caseFile.origin.final_assembly_country ?? '';
    const hts = await getRateBearingHtsLine(c.env, code);
    if (!hts) {
      return c.json({ error: `HTS line ${code} not found in reference data -- cannot compute duty stack.` }, 500);
    }
    const overlays = await getApplicableOverlays(c.env, code, country || null);
    await logCaseEvent(c.env, caseId, 'determination', 'candidate_set', { code, country, overlays });

    const { lines, totalPct } = buildDutyStack(hts, country, caseFile.origin.qualifies, overlays);

    let narration: ImportNarrationOutput;
    try {
      narration = await callClaudeTool<ImportNarrationOutput>(c.env, {
        system: IMPORT_NARRATION_SYSTEM_PROMPT,
        userContent: buildImportNarrationUserContent(code, country, lines, totalPct),
        tool: buildImportNarrationTool(),
      });
    } catch (err) {
      if (err instanceof ClaudeGroundingError) return c.json({ error: `Determination narration error: ${err.message}` }, 502);
      throw err;
    }

    const hardStop = caseFile.screening.hard_stop_triggered;
    // An indeterminate USMCA qualification only blocks a "clear" verdict when
    // USMCA is actually claimable (country is CA/MX) -- for any other origin
    // country USMCA is simply not relevant, and origin.qualifies=null there
    // just reflects "not applicable," not a real gap needing manual review.
    const usmcaRelevant = country === 'CA' || country === 'MX';
    const verdict: Verdict = hardStop
      ? 'stop'
      : caseFile.classification.ambiguous ||
          (usmcaRelevant && caseFile.origin.qualifies === null) ||
          totalPct === null ||
          caseFile.screening.highest_severity === 'caution'
        ? 'review_required'
        : 'clear';

    caseFile.determination = {
      status: 'complete',
      direction: 'import',
      duty_stack: lines,
      landed_cost_estimate_pct: totalPct,
      destination_country: null,
      eccn: null,
      reasons_for_control: null,
      license_requirement: null,
      license_exception_candidates: null,
      denied_party_override: hardStop,
      reasoning: {
        summary: narration.summary,
        steps: narration.reasoning_steps,
        cited_sources: lines.filter((l) => l.source).map((l) => l.source!),
        confidence: narration.confidence,
      },
      verdict,
    };
    for (const issue of narration.open_issues) caseFile.open_issues.push(`Determination: ${issue}`);
    if (totalPct === null) {
      caseFile.open_issues.push('Determination: one or more duty-stack lines have a non-ad-valorem (specific/compound) rate this app cannot sum automatically -- compute manually.');
    }

    await saveCaseFile(c.env, caseFile);
    await logCaseEvent(c.env, caseId, 'determination', 'claude_response', narration);
    return c.json({ determination: caseFile.determination });
  }

  // Export path: self-classify ECCN, then look up license requirement via the
  // country chart. A Module 3 denied-party hard stop overrides everything.
  // Destination is a distinct concept from Module 2's final_assembly_country
  // (where the good was made vs. where it's being shipped to), so it's
  // collected here, at determination time, from the request body.
  const body = await c.req.json<{ destination_country?: string }>().catch(() => ({}) as { destination_country?: string });
  const country = (body.destination_country ?? '').toUpperCase();
  if (!country) {
    return c.json({ error: 'destination_country is required to run an export determination.' }, 400);
  }

  const eccnCandidates = await searchEccn(c.env, caseFile.classification.product_description);
  const earCandidates = await getEccnByCode(c.env, 'EAR99');
  const allCandidates = earCandidates && !eccnCandidates.some((e) => e.eccn === 'EAR99') ? [...eccnCandidates, earCandidates] : eccnCandidates;
  await logCaseEvent(c.env, caseId, 'determination', 'candidate_set', { eccnCandidates: allCandidates });

  let eccnOutput: ExportEccnOutput;
  try {
    eccnOutput = await callClaudeTool<ExportEccnOutput>(c.env, {
      system: EXPORT_ECCN_SYSTEM_PROMPT,
      userContent: buildExportEccnUserContent(caseFile.classification.product_description, code, allCandidates),
      tool: buildExportEccnTool(allCandidates.map((e) => e.eccn)),
    });
  } catch (err) {
    if (err instanceof ClaudeGroundingError) return c.json({ error: `ECCN classification error: ${err.message}` }, 502);
    throw err;
  }

  const hardStop = caseFile.screening.hard_stop_triggered;
  const selected = allCandidates.find((e) => e.eccn === eccnOutput.selected_eccn);
  const reasonsForControl: string[] = selected ? JSON.parse(selected.reasons_for_control || '[]') : [];

  let licenseRequirement: 'NLR' | 'License Required' | 'License Exception May Apply' | 'Insufficient Data';
  let licenseReasoningNote = '';
  const coverage = country ? await getCountryCoverage(c.env, country) : null;

  if (hardStop) {
    licenseRequirement = 'License Required';
    licenseReasoningNote = 'Overridden by a true match against the BIS Entity List/Denied Persons List in Module 3 -- license-determinative regardless of ECCN.';
  } else if (!selected || selected.eccn === 'EAR99' || reasonsForControl.length === 0) {
    licenseRequirement = 'NLR';
    licenseReasoningNote = 'EAR99 or no reason-for-control match -- No License Required for standard commercial export, subject to standard embargo/denied-party/end-use screening.';
  } else if (!coverage || coverage.status === 'not_curated') {
    licenseRequirement = 'Insufficient Data';
    licenseReasoningNote = `Destination "${country}" is not in this app's curated Commerce Country Chart coverage -- cannot determine license requirement automatically. Consult 15 CFR 738 Supp. 1 directly.`;
  } else if (coverage.status === 'comprehensive_embargo' || coverage.status === 'broad_restriction_746_5') {
    licenseRequirement = 'License Required';
    licenseReasoningNote = `Destination "${country}" is subject to a comprehensive or near-comprehensive EAR restriction (${coverage.notes ?? coverage.status}) -- license required regardless of the specific reason-for-control match.`;
  } else {
    const chartRows = await getCountryChartRows(c.env, country);
    const chartReasonPrefixes = new Set(chartRows.map((r) => r.reason_for_control.replace(/\d+$/, '')));
    const matchedReason = reasonsForControl.find((r) => chartReasonPrefixes.has(r));
    if (matchedReason) {
      const exceptions: string[] = selected ? JSON.parse(selected.license_exceptions || '[]') : [];
      licenseRequirement = exceptions.length > 0 ? 'License Exception May Apply' : 'License Required';
      licenseReasoningNote = `Destination "${country}" is marked for reason-for-control "${matchedReason}" on the Commerce Country Chart, matching this ECCN's reasons_for_control. ${
        exceptions.length > 0 ? `License exceptions that may apply: ${exceptions.join(', ')} -- verify eligibility conditions before relying on this.` : 'No license exception is curated for this ECCN in this app.'
      }`;
    } else {
      licenseRequirement = 'NLR';
      licenseReasoningNote = `Destination "${country}" has curated Commerce Country Chart coverage, but none of its marked reasons-for-control match this ECCN's reasons_for_control (${reasonsForControl.join(', ')}) -- No License Required.`;
    }
  }

  const verdict: Verdict =
    licenseRequirement === 'License Required' || hardStop
      ? 'stop'
      : licenseRequirement === 'Insufficient Data' || licenseRequirement === 'License Exception May Apply' || caseFile.classification.ambiguous || eccnOutput.no_match
        ? 'review_required'
        : 'clear';

  caseFile.determination = {
    status: 'complete',
    direction: 'export',
    duty_stack: null,
    landed_cost_estimate_pct: null,
    destination_country: country || null,
    eccn: eccnOutput.no_match ? null : eccnOutput.selected_eccn,
    reasons_for_control: reasonsForControl,
    license_requirement: licenseRequirement,
    license_exception_candidates: selected ? JSON.parse(selected.license_exceptions || '[]') : [],
    denied_party_override: hardStop,
    reasoning: {
      summary: licenseReasoningNote,
      steps: [...eccnOutput.reasoning_steps, licenseReasoningNote],
      cited_sources: selected ? [{ source_url: selected.source_url, source_tier: selected.source_tier as 1 | 2 | 3, last_updated: selected.last_updated }] : [],
      confidence: eccnOutput.confidence,
    },
    verdict,
  };

  if (eccnOutput.no_match) {
    caseFile.open_issues.push('Determination: no curated ECCN candidate plausibly matched this product, and EAR99 was not retrieved as a candidate -- manual self-classification required.');
  }
  if (licenseRequirement === 'Insufficient Data') {
    caseFile.open_issues.push(`Determination: destination "${country}" is not curated in this app's Commerce Country Chart data -- consult 15 CFR 738 Supp. 1 directly before relying on this.`);
  }

  await saveCaseFile(c.env, caseFile);
  await logCaseEvent(c.env, caseId, 'determination', 'claude_response', eccnOutput);
  return c.json({ determination: caseFile.determination });
});
