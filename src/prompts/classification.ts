import type Anthropic from '@anthropic-ai/sdk';
import type { HtsCandidateRow, ScheduleBCandidateRow } from '../lib/db.js';
import type { Direction } from '../types/case.js';

export const CLASSIFICATION_SYSTEM_PROMPT = `You are a customs classification analyst applying the General Rules of Interpretation (GRI) of the Harmonized System to classify a product.

Reasoning order (apply in this sequence, per GRI 1-6):
1. GRI 1: Classification is determined first by the terms of the headings and any relevant section/chapter notes. Do not skip to essential-character analysis if a heading's plain terms (read with its notes) already resolve the classification.
2. GRI 2: Covers incomplete/unfinished articles (classified as the complete article if they have its essential character) and unassembled articles, and mixtures/combinations of materials.
3. GRI 3: Applies only when GRI 1/2 leave two or more headings each covering part of the goods. Apply in strict order: (a) the heading with the most specific description prevails over a more general one; (b) failing that, classify by the material or component that gives the goods their essential character; (c) failing that, use the heading that occurs last in numerical order among those equally meriting consideration.
4. GRI 4: Goods not classifiable under GRI 1-3 are classified under the heading for goods most akin to them.
5. GRI 5: Rules for packing materials/containers.
6. GRI 6: Classification at the subheading level follows the same GRI principles, applied at that level, comparing only subheadings of the same level.

You will be given a plain-English product description and a list of CANDIDATE codes actually retrieved from the reference database (full-text search over the real tariff schedule). You MUST select your answer from this candidate list only -- you are not able to invent a code that is not listed, and the tool schema will reject anything else. If the true correct classification does not appear to be among the candidates, still pick the closest candidate as selected_code, but set ambiguous=true and explain the gap in reasoning_steps -- do not fabricate a better-fitting code.

If two or more candidates are genuinely plausible after applying GRI 1-3 (e.g. the product could reasonably be classified two different ways depending on a fact not given, such as principal use or material composition by weight), set ambiguous=true and list the other plausible candidate code(s) in ambiguous_alternatives. Do not silently pick one and hide the ambiguity -- a compliance analyst needs to see it.

Write reasoning_steps as a short numbered list showing which GRI rule(s) you applied and why, referencing the specific candidate descriptions by code.`;

export function buildClassificationUserContent(
  productDescription: string,
  direction: Direction,
  candidates: (HtsCandidateRow | ScheduleBCandidateRow)[]
): string {
  const schedule = direction === 'import' ? 'HTS (Harmonized Tariff Schedule)' : 'Schedule B';
  const list = candidates
    .map((c) => {
      const code = 'htsno' in c ? c.htsno : c.code;
      return `- ${code}: ${c.description}`;
    })
    .join('\n');
  return `Product description: "${productDescription}"

Direction: ${direction} (classify against the ${schedule})

Candidate codes retrieved from the reference database (select only from these):
${list || '(no candidates retrieved -- the database full-text search returned nothing close to this description)'}`;
}

export function buildClassificationTool(candidateCodes: string[]): Anthropic.Tool {
  const codes = candidateCodes.length > 0 ? candidateCodes : ['NONE'];
  return {
    name: 'propose_classification',
    description: 'Propose an HTS or Schedule B classification grounded strictly in the provided candidate codes.',
    input_schema: {
      type: 'object',
      properties: {
        selected_code: {
          type: 'string',
          enum: codes,
          description: 'The best-fit candidate code, applying GRI 1-6 in order.',
        },
        ambiguous: {
          type: 'boolean',
          description: 'True if two or more candidates are genuinely plausible.',
        },
        ambiguous_alternatives: {
          type: 'array',
          items: { type: 'string', enum: codes },
          description: 'Other plausible candidate codes, when ambiguous is true. Empty array otherwise.',
        },
        reasoning_steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Numbered GRI-based reasoning steps, referencing candidate codes.',
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
        },
      },
      required: ['selected_code', 'ambiguous', 'ambiguous_alternatives', 'reasoning_steps', 'confidence'],
    },
  };
}

export interface ClassificationToolOutput {
  selected_code: string;
  ambiguous: boolean;
  ambiguous_alternatives: string[];
  reasoning_steps: string[];
  confidence: 'high' | 'medium' | 'low';
}
