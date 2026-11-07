import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { getCaseFile, saveCaseFile, logCaseEvent } from '../lib/caseStore.js';
import { getRateBearingHtsLine, getApplicableOverlays, searchEccn, getEccnByCode, getCountryCoverage, getCountryChartRows, getAllEccn } from '../lib/db.js';
import { buildDutyStack, splitOverlaysByDate, USMCA_COUNTRIES } from '../lib/dutyStack.js';
import { computeEntryFees } from '../lib/customsFees.js';
import { describeAlerts, programsForOverlays, staleness } from '../lib/curatedWatch.js';
import { curatedBaselines, getPendingAlerts } from '../lib/refresh/curatedWatch.js';
import { narrateDutyStack } from '../lib/dutyNarration.js';
import { decideExportLicense } from '../lib/exportLicense.js';
import { callClaudeTool, ClaudeGroundingError } from '../lib/anthropic.js';
import { readObject } from '../lib/requestBody.js';
import {
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
  // Origin (Module 2) is a USMCA/duty-stack input, which only the import
  // path uses -- an export determination turns on classification, screening
  // and destination, so requiring origin there blocked a real workflow for
  // no reason.
  const originNeeded = caseFile.direction === 'import';
  if (caseFile.classification.status !== 'complete' || caseFile.screening.status !== 'complete' || (originNeeded && caseFile.origin.status !== 'complete')) {
    return c.json(
      {
        error: originNeeded
          ? 'Modules 1-3 (classification, origin, screening) must be complete before Module 4 (determination).'
          : 'Modules 1 and 3 (classification, screening) must be complete before Module 4 (determination).',
      },
      409
    );
  }

  const code = caseFile.classification.selected_code!;

  // Shared by both branches below the direction check, but only the import
  // branch currently does anything with it (a declared value has no meaning
  // for an export license determination).
  const reqBody = await readObject<{ declared_value_usd: number; destination_country: string }>(c.req);
  if (reqBody.destination_country !== undefined && typeof reqBody.destination_country !== 'string') {
    return c.json({ error: 'destination_country must be a text country code when provided.' }, 400);
  }
  if (reqBody.declared_value_usd !== undefined && !(typeof reqBody.declared_value_usd === 'number' && Number.isFinite(reqBody.declared_value_usd) && reqBody.declared_value_usd >= 0)) {
    return c.json({ error: 'declared_value_usd must be a non-negative number when provided.' }, 400);
  }

  if (caseFile.direction === 'import') {
    // Import: country of origin (where the good was made) drives both USMCA
    // eligibility and the 232/301/338 overlay lookups -- Module 2's
    // final_assembly_country is the right field for this.
    // Uppercased defensively: origin.ts now normalizes this at write time,
    // but a case file saved before that fix could still carry a lowercase
    // value, and dutyStack.ts's CA/MX checks are case-sensitive.
    const country = (caseFile.origin.final_assembly_country ?? '').toUpperCase();
    const hts = await getRateBearingHtsLine(c.env, code);
    if (!hts) {
      return c.json({ error: `HTS line ${code} not found in reference data. Cannot compute duty stack.` }, 422);
    }
    const today = new Date().toISOString().slice(0, 10);
    const { active: overlays, inactive: inactiveOverlays } = splitOverlaysByDate(await getApplicableOverlays(c.env, code, country || null), today);
    await logCaseEvent(c.env, caseId, 'determination', 'candidate_set', { code, country, overlays });

    const { lines, totalPct } = buildDutyStack(hts, country, caseFile.origin.qualifies, overlays);

    // Dollar figures and the Section 321 de minimis check both depend only on
    // a declared value the user may or may not have supplied -- both stay
    // null without one, same "don't guess a number nobody gave us" rule as
    // totalPct itself.
    const declaredValueUsd = reqBody.declared_value_usd ?? null;
    const landedCostUsd = declaredValueUsd !== null && totalPct !== null ? Math.round(declaredValueUsd * (1 + totalPct / 100) * 100) / 100 : null;
    const DE_MINIMIS_THRESHOLD_USD = 800;
    // deMinimisEligible reflects ONLY the dollar threshold in 19 CFR 10.151 --
    // the one part of Section 321 this app can check with certainty. It is
    // deliberately not a full eligibility call: AD/CVD orders, quota goods,
    // certain FDA/other-agency-regulated merchandise, and country-specific
    // executive actions suspending de minimis treatment can all independently
    // disqualify a shipment under $800, and this app has no source wired up
    // to check any of those -- the note below says so every time.
    const deMinimisEligible = declaredValueUsd === null ? null : declaredValueUsd <= DE_MINIMIS_THRESHOLD_USD;
    const deMinimisNote =
      declaredValueUsd === null
        ? null
        : deMinimisEligible
          ? `Declared value of $${declaredValueUsd.toFixed(2)} is at or under the $${DE_MINIMIS_THRESHOLD_USD} Section 321 de minimis threshold (19 CFR 10.151), but this checks only the dollar threshold. Antidumping/countervailing-duty orders, quota merchandise, certain FDA- or other-agency-regulated goods, and recent country-specific executive actions suspending de minimis treatment can still disqualify a shipment under that threshold, and this app does not check any of those. Confirm with a licensed customs broker before relying on duty-free entry.`
          : `Declared value of $${declaredValueUsd.toFixed(2)} exceeds the $${DE_MINIMIS_THRESHOLD_USD} Section 321 de minimis threshold (19 CFR 10.151). Not eligible for de minimis treatment regardless of other factors.`;

    const narration = narrateDutyStack(code, country, lines, totalPct);

    const entryFees = computeEntryFees({ valueUsd: declaredValueUsd, date: today, country, usmcaQualifies: caseFile.origin.qualifies });

    // Notices newer than the curated data, and how old that data is: either one stops this case being called clear.
    const touched = programsForOverlays(overlays.map((o) => o.program), country);
    const pendingAlerts = await getPendingAlerts(c.env, touched).catch(() => []);
    const usedAsOf = overlays.map((o) => o.data_as_of).sort()[0];
    const freshness = usedAsOf ? staleness('tariff overlays', usedAsOf, today) : null;
    const dataNeedsReview = pendingAlerts.length > 0 || freshness?.level === 'stale';

    const hardStop = caseFile.screening.hard_stop_triggered;
    // An indeterminate USMCA qualification only blocks a "clear" verdict when
    // USMCA is actually claimable (country is CA/MX) -- for any other origin
    // country USMCA is simply not relevant, and origin.qualifies=null there
    // just reflects "not applicable," not a real gap needing manual review.
    const usmcaRelevant = USMCA_COUNTRIES.has(country);
    // China-origin goods can carry a Section 301 duty this app has no verified
    // data for (see dutyStack.ts) -- the estimate is knowingly incomplete, so
    // it can't be called "clear".
    const china301Unevaluated = country === 'CN' && !overlays.some((o) => o.program === 'sec301_china');
    const verdict: Verdict = hardStop
      ? 'stop'
      : caseFile.classification.ambiguous ||
          china301Unevaluated ||
          (usmcaRelevant && caseFile.origin.qualifies === null) ||
          totalPct === null ||
          dataNeedsReview ||
          caseFile.screening.highest_severity === 'caution'
        ? 'review_required'
        : 'clear';

    caseFile.determination = {
      status: 'complete',
      direction: 'import',
      entry_fees: entryFees,
      duty_stack: lines,
      landed_cost_estimate_pct: totalPct,
      declared_value_usd: declaredValueUsd,
      landed_cost_usd: landedCostUsd,
      de_minimis_eligible: deMinimisEligible,
      de_minimis_note: deMinimisNote,
      destination_country: null,
      eccn: null,
      reasons_for_control: null,
      license_requirement: null,
      license_exception_candidates: null,
      denied_party_override: hardStop,
      reasoning: {
        summary: narration.summary,
        steps: narration.steps,
        cited_sources: lines.filter((l) => l.source).map((l) => l.source!),
        confidence: narration.confidence,
      },
      verdict,
    };
    for (const issue of narration.open_issues) caseFile.open_issues.push(`Determination: ${issue}`);
    if (china301Unevaluated) {
      caseFile.open_issues.push(
        'Determination: goods of China may be subject to an additional Section 301 duty that this app has no verified data for. The estimated total excludes it. Check the HTS code against the current USTR Section 301 lists (HTSUS Chapter 99) before relying on this figure.'
      );
    }
    for (const issue of describeAlerts(pendingAlerts)) caseFile.open_issues.push(issue);
    if (freshness && freshness.level !== 'ok') {
      caseFile.open_issues.push(
        `Determination: the Section 232/301/338 figures were last verified on ${freshness.dataAsOf} (${freshness.ageDays} days ago).${freshness.level === 'stale' ? ' That is too old to call this estimate clear.' : ' Confirm they are still current.'}`
      );
    }
    for (const { row, reason } of inactiveOverlays) {
      caseFile.open_issues.push(`Determination: the ${row.program.replace(/_/g, ' ')} rule for HTS ${row.hts_pattern} ${reason}, so it was not charged. Confirm whether a replacement applies.`);
    }
    caseFile.open_issues.push(
      'Determination: the total covers the HTS rate and the Section 232, 301 and 338 layers loaded in this app. It does not model antidumping or countervailing duty orders, Section 201 safeguards, or any IEEPA- or Section 122-based surcharges. Check current CBP guidance for those before relying on the total.'
    );
    if (totalPct === null) {
      caseFile.open_issues.push('Determination: one or more duty-stack lines have a non-ad-valorem (specific/compound) rate this app cannot sum automatically. Compute manually.');
    }

    await saveCaseFile(c.env, caseFile);
    return c.json({ determination: caseFile.determination });
  }

  // Export path: self-classify ECCN, then look up license requirement via the
  // country chart. A Module 3 denied-party hard stop overrides everything.
  // Destination is a distinct concept from Module 2's final_assembly_country
  // (where the good was made vs. where it's being shipped to), so it's
  // collected here, at determination time, from the request body.
  const country = (reqBody.destination_country ?? '').toUpperCase();
  if (!country) {
    return c.json({ error: 'destination_country is required to run an export determination.' }, 400);
  }

  // The curated ECCN table is small enough to give the model whole; if it ever grows past that, fall back to the text-search shortlist plus EAR99.
  const wholeTable = await getAllEccn(c.env);
  let allCandidates = wholeTable ?? (await searchEccn(c.env, caseFile.classification.product_description));
  if (!wholeTable) {
    const earCandidates = await getEccnByCode(c.env, 'EAR99');
    if (earCandidates && !allCandidates.some((e) => e.eccn === 'EAR99')) allCandidates = [...allCandidates, earCandidates];
  }
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
  // Defensive re-check, matching classification.ts's rule: never trust the
  // wire blindly, even though the tool schema's enum should make this
  // structurally impossible. Without this, an ungrounded selected_eccn (not
  // in allCandidates, yet no_match=false) would persist as if it were a real,
  // grounded code, and reasonsForControl would silently resolve to [].
  const ungroundedEccn = !eccnOutput.no_match && !selected;
  const reasonsForControl: string[] = selected ? JSON.parse(selected.reasons_for_control || '[]') : [];

  const coverage = country ? await getCountryCoverage(c.env, country) : null;
  const chartRows = coverage && coverage.status === 'curated' ? await getCountryChartRows(c.env, country) : [];
  const verifiedReasons = new Set(
    (await c.env.DB.prepare(`SELECT DISTINCT reason_for_control AS r FROM country_chart`).all<{ r: string }>()).results.map((x) => x.r.replace(/\d+$/, ''))
  );
  const decision = decideExportLicense({
    country,
    hardStop,
    coverage,
    eccn: selected ? { eccn: selected.eccn, reasonsForControl, licenseExceptions: JSON.parse(selected.license_exceptions || '[]') } : null,
    chartRows,
    verifiedReasons,
  });
  const licenseRequirement = decision.requirement;
  const licenseReasoningNote = decision.note;

  const exportAlerts = await getPendingAlerts(c.env, ['export_controls']).catch(() => []);
  const exportAsOf = (await curatedBaselines(c.env).catch(() => ({}) as Record<string, string>)).export_controls;
  const exportFreshness = exportAsOf ? staleness('export controls', exportAsOf, new Date().toISOString().slice(0, 10)) : null;
  // EAR99 here only means "none of the entries this app carries". A product in a strategic field may sit under one it does not.
  const maybeElsewhere = eccnOutput.possibly_controlled_elsewhere === true && (!selected || selected.eccn === 'EAR99');
  const exportDataNeedsReview = exportAlerts.length > 0 || exportFreshness?.level === 'stale' || maybeElsewhere;

  const verdict: Verdict =
    licenseRequirement === 'License Required' || hardStop
      ? 'stop'
      : licenseRequirement === 'Insufficient Data' ||
          licenseRequirement === 'License Exception May Apply' ||
          // Same rule the import path applies: a true UK-list/MEU match or an
          // unresolved name match can't be called "clear" just because the
          // item itself needs no license.
          caseFile.screening.highest_severity === 'caution' ||
          caseFile.classification.ambiguous ||
          eccnOutput.no_match ||
          ungroundedEccn ||
          exportDataNeedsReview
        ? 'review_required'
        : 'clear';

  caseFile.determination = {
    status: 'complete',
    direction: 'export',
    duty_stack: null,
    landed_cost_estimate_pct: null,
    declared_value_usd: null,
    landed_cost_usd: null,
    de_minimis_eligible: null,
    de_minimis_note: null,
    destination_country: country || null,
    eccn: eccnOutput.no_match || ungroundedEccn ? null : eccnOutput.selected_eccn,
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
    caseFile.open_issues.push('Determination: no curated ECCN candidate plausibly matched this product, and EAR99 was not retrieved as a candidate. Manual self-classification required.');
  } else if (ungroundedEccn) {
    caseFile.open_issues.push(
      `Determination: model returned an ECCN (${eccnOutput.selected_eccn}) outside the retrieved candidate set. Discarded and flagged for manual review.`
    );
  }
  for (const issue of describeAlerts(exportAlerts)) caseFile.open_issues.push(issue);
  if (maybeElsewhere) {
    caseFile.open_issues.push(
      'Determination: this product is in a field the Commerce Control List controls, and it did not match any of the few entries this app carries. EAR99 here means only "not one of those entries". Check the full Commerce Control List (15 CFR Part 774) before treating it as uncontrolled.'
    );
  }
  if (exportFreshness && exportFreshness.level !== 'ok') {
    caseFile.open_issues.push(
      `Determination: the ECCN and Country Chart data were last verified on ${exportFreshness.dataAsOf} (${exportFreshness.ageDays} days ago).${exportFreshness.level === 'stale' ? ' That is too old to call this determination clear.' : ' Confirm it is still current.'}`
    );
  }
  if (licenseRequirement === 'Insufficient Data') {
    caseFile.open_issues.push(
      coverage?.status === 'broad_restriction_746_5'
        ? `Determination: destination "${country}" is under near-comprehensive EAR restrictions that reach many EAR99 items. Check Supplements 2, 4 and 6 to 15 CFR Part 746 before shipping.`
        : `Determination: destination "${country}" is not curated in this app's Commerce Country Chart data. Consult 15 CFR 738 Supp. 1 directly before relying on this.`
    );
  }

  await saveCaseFile(c.env, caseFile);
  await logCaseEvent(c.env, caseId, 'determination', 'claude_response', eccnOutput);
  return c.json({ determination: caseFile.determination });
});
