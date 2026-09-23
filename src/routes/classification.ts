import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { getCaseFile, saveCaseFile, logCaseEvent } from '../lib/caseStore.js';
import { searchHts, searchScheduleB, getCrossReferenceForHts, getCrossReferenceForScheduleB } from '../lib/db.js';
import { callClaudeTool, ClaudeGroundingError } from '../lib/anthropic.js';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationUserContent,
  buildClassificationTool,
  type ClassificationToolOutput,
} from '../prompts/classification.js';

export const classificationRoute = new Hono<{ Bindings: Env }>();

classificationRoute.post('/:id/classification', async (c) => {
  const caseId = c.req.param('id');
  const caseFile = await getCaseFile(c.env, caseId);
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);

  const body = await c.req.json<{ product_description: string }>();
  const productDescription = body.product_description?.trim();
  if (!productDescription) return c.json({ error: 'product_description is required' }, 400);

  const direction = caseFile.direction;
  const candidates = direction === 'import' ? await searchHts(c.env, productDescription) : await searchScheduleB(c.env, productDescription);
  const candidateCodes = candidates.map((cand) => ('htsno' in cand ? cand.htsno : cand.code));

  await logCaseEvent(c.env, caseId, 'classification', 'candidate_set', { productDescription, candidateCodes });

  if (candidateCodes.length === 0) {
    caseFile.classification = {
      ...caseFile.classification,
      status: 'blocked',
      direction,
      product_description: productDescription,
      candidates_considered: [],
      selected_code: null,
      hs6: null,
      cross_reference_code: null,
      cross_reference_candidates: [],
      ambiguous: true,
      ambiguous_alternatives: [],
      reasoning: {
        summary: 'No candidate codes were retrieved from the reference database for this description.',
        steps: ['Full-text search against the reference schedule returned no results close to this description.'],
        cited_sources: [],
        confidence: 'low',
      },
    };
    caseFile.open_issues.push('Classification: no database-grounded candidates found -- needs manual analyst review.');
    await saveCaseFile(c.env, caseFile);
    return c.json({ classification: caseFile.classification });
  }

  let output: ClassificationToolOutput;
  try {
    output = await callClaudeTool<ClassificationToolOutput>(c.env, {
      system: CLASSIFICATION_SYSTEM_PROMPT,
      userContent: buildClassificationUserContent(productDescription, direction, candidates),
      tool: buildClassificationTool(candidateCodes),
    });
  } catch (err) {
    if (err instanceof ClaudeGroundingError) {
      return c.json({ error: `Classification engine could not ground an answer: ${err.message}` }, 502);
    }
    throw err;
  }

  // Defensive re-check: never trust the wire blindly, even though the tool
  // schema's enum should make this structurally impossible.
  if (!candidateCodes.includes(output.selected_code)) {
    caseFile.open_issues.push(
      `Classification: model returned a code (${output.selected_code}) outside the retrieved candidate set -- discarded, flagged for manual review.`
    );
    caseFile.classification = {
      status: 'blocked',
      direction,
      product_description: productDescription,
      candidates_considered: candidates.map((cand) => ({
        code: 'htsno' in cand ? cand.htsno : cand.code,
        description: cand.description,
        score: cand.score,
      })),
      selected_code: null,
      hs6: null,
      cross_reference_code: null,
      cross_reference_candidates: [],
      ambiguous: true,
      ambiguous_alternatives: [],
      reasoning: {
        summary: 'Classification engine could not ground an answer in the reference data.',
        steps: [],
        cited_sources: [],
        confidence: 'low',
      },
    };
    await saveCaseFile(c.env, caseFile);
    return c.json({ classification: caseFile.classification });
  }
  const badAlternatives = output.ambiguous_alternatives.filter((a) => !candidateCodes.includes(a));
  const ambiguousAlternatives = output.ambiguous_alternatives.filter((a) => candidateCodes.includes(a));
  if (badAlternatives.length > 0) {
    caseFile.open_issues.push(`Classification: discarded ungrounded ambiguous_alternatives: ${badAlternatives.join(', ')}`);
  }

  const selected = candidates.find((cand) => ('htsno' in cand ? cand.htsno : cand.code) === output.selected_code)!;
  const hs6 = output.selected_code.replace(/\./g, '').slice(0, 6);

  const crossRefs =
    direction === 'import'
      ? await getCrossReferenceForHts(c.env, output.selected_code)
      : await getCrossReferenceForScheduleB(c.env, output.selected_code);

  caseFile.classification = {
    status: 'complete',
    direction,
    product_description: productDescription,
    candidates_considered: candidates.map((cand) => ({
      code: 'htsno' in cand ? cand.htsno : cand.code,
      description: cand.description,
      score: cand.score,
    })),
    selected_code: output.selected_code,
    hs6,
    cross_reference_code: crossRefs[0] ?? null,
    cross_reference_candidates: crossRefs,
    ambiguous: output.ambiguous,
    ambiguous_alternatives: ambiguousAlternatives,
    reasoning: {
      summary: `Classified as ${output.selected_code}: ${selected.description}`,
      steps: output.reasoning_steps,
      cited_sources: [
        {
          source_url: selected.source_url,
          source_tier: selected.source_tier as 1 | 2 | 3,
          last_updated: selected.last_updated,
        },
      ],
      confidence: output.ambiguous ? (output.confidence === 'high' ? 'medium' : output.confidence) : output.confidence,
    },
  };
  if (output.ambiguous) {
    caseFile.open_issues.push(
      `Classification is ambiguous between ${output.selected_code} and ${ambiguousAlternatives.join(', ')} -- confirm with analyst before relying on this for duty/license determination.`
    );
  }

  await saveCaseFile(c.env, caseFile);
  await logCaseEvent(c.env, caseId, 'classification', 'claude_response', output);
  return c.json({ classification: caseFile.classification });
});
