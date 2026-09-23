import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { getCaseFile, saveCaseFile, logCaseEvent } from '../lib/caseStore.js';
import { findUsmcaRule } from '../lib/db.js';
import { callClaudeTool, ClaudeGroundingError } from '../lib/anthropic.js';
import { ORIGIN_SYSTEM_PROMPT, buildOriginUserContent, buildOriginTool, type OriginToolOutput } from '../prompts/origin.js';
import type { OriginComponent } from '../types/case.js';

export const originRoute = new Hono<{ Bindings: Env }>();

originRoute.post('/:id/origin', async (c) => {
  const caseId = c.req.param('id');
  const caseFile = await getCaseFile(c.env, caseId);
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);
  if (caseFile.classification.status !== 'complete') {
    return c.json({ error: 'Module 1 (classification) must be complete before Module 2 (origin).' }, 409);
  }

  const body = await c.req.json<{ components: OriginComponent[]; final_assembly_country: string }>();
  const code = caseFile.classification.selected_code!;

  const rule = await findUsmcaRule(c.env, code);
  await logCaseEvent(c.env, caseId, 'origin', 'candidate_set', { code, rule });

  if (!rule) {
    caseFile.origin = {
      status: 'complete',
      applicable_rule: null,
      components: body.components,
      final_assembly_country: body.final_assembly_country,
      tariff_shift_met: null,
      rvc_calculated_pct: null,
      rvc_threshold_pct: null,
      qualifies: null,
      reasoning: {
        summary: `No curated USMCA rule found for heading ${code} in this app's reference data. This is a real, disclosed coverage gap -- not a "does not qualify" determination.`,
        steps: [
          `Checked usmca_rules for chapter ${code.slice(0, 2)} and heading prefixes of ${code}; no match.`,
          'Per General Note 11, HTSUS, every heading has an applicable origin rule -- this app simply has not curated it yet.',
        ],
        cited_sources: [],
        confidence: 'low',
      },
    };
    caseFile.open_issues.push(
      `Origin: heading ${code} has no curated USMCA rule in this app -- qualification is indeterminate, consult General Note 11 (HTSUS) directly.`
    );
    await saveCaseFile(c.env, caseFile);
    return c.json({ origin: caseFile.origin });
  }

  let output: OriginToolOutput;
  try {
    output = await callClaudeTool<OriginToolOutput>(c.env, {
      system: ORIGIN_SYSTEM_PROMPT,
      userContent: buildOriginUserContent(code, rule, body.components, body.final_assembly_country),
      tool: buildOriginTool(),
    });
  } catch (err) {
    if (err instanceof ClaudeGroundingError) return c.json({ error: `Origin engine error: ${err.message}` }, 502);
    throw err;
  }

  caseFile.origin = {
    status: 'complete',
    applicable_rule: { rule_id: rule.id, rule_type: rule.rule_type, citation: rule.citation },
    components: body.components,
    final_assembly_country: body.final_assembly_country,
    tariff_shift_met: output.tariff_shift_met,
    rvc_calculated_pct: output.rvc_calculated_pct,
    rvc_threshold_pct: rule.rvc_threshold_pct,
    qualifies: output.insufficient_facts ? null : output.qualifies,
    reasoning: {
      summary: output.insufficient_facts
        ? 'Insufficient facts given to determine USMCA qualification with confidence.'
        : output.qualifies
          ? `Qualifies for USMCA preferential treatment under ${rule.citation}.`
          : `Does not appear to qualify for USMCA preferential treatment under ${rule.citation}.`,
      steps: output.reasoning_steps,
      cited_sources: [{ source_url: rule.source_url, source_tier: rule.source_tier as 1 | 2 | 3, last_updated: rule.last_updated }],
      confidence: output.confidence,
    },
  };

  for (const issue of output.open_issues) {
    caseFile.open_issues.push(`Origin: ${issue}`);
  }
  if (output.insufficient_facts) {
    caseFile.open_issues.push('Origin: facts provided are insufficient to determine USMCA qualification -- flagged for manual review.');
  }

  await saveCaseFile(c.env, caseFile);
  await logCaseEvent(c.env, caseId, 'origin', 'claude_response', output);
  return c.json({ origin: caseFile.origin });
});
