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

When a candidate line states a numeric limit (a thickness, width, weight, size, percentage or value, with wording such as "not exceeding", "exceeding", "or more but less than"), compare the figure given in the product description with each limit explicitly, including which side of the boundary it falls on, and show that comparison in reasoning_steps. A 5 mm thickness is not "less than 4.75 mm"; a 2 kg package is "not exceeding 3 kg". If the description does not give the figure that decides between candidates, set ambiguous=true rather than assuming it. A typical or common value for this kind of product (for example, the usual weight of office copy paper) is not a stated value: do not use it to choose a candidate, and name the missing figure in reasoning_steps.

Write reasoning_steps as a short numbered list showing which GRI rule(s) you applied and why, referencing the specific candidate descriptions by code.`;

export function buildClassificationUserContent(
  productDescription: string,
  direction: Direction,
  candidates: (HtsCandidateRow | ScheduleBCandidateRow)[],
  ancestors?: Map<number, string[]>
): string {
  const schedule = direction === 'import' ? 'HTS (Harmonized Tariff Schedule)' : 'Schedule B';
  // A line's own text is often just "Other" or "Other household"; what it
  // actually covers is set by its parent headings, shown in [brackets] from
  // the top heading down. Read them as part of the line (GRI 1).
  const list = candidates
    .map((c) => {
      const code = 'htsno' in c ? c.htsno : c.code;
      const chain = 'htsno' in c ? ancestors?.get(c.id) : undefined;
      return chain && chain.length > 0 ? `- ${code}: [${chain.join(' > ')}] ${c.description}` : `- ${code}: ${c.description}`;
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
      // Field order matters: the model writes these fields in this order, so the reasoning comes before the answer it supports. With the answer first it
      // commits to a value and then writes reasoning that cannot change it (seen in testing: reasoning that named the right code under a different selected_code).
      properties: {
        reasoning_steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Numbered GRI-based reasoning steps, referencing candidate codes. Write these first; the code you select must be the one they conclude with.',
        },
        selected_code: {
          type: 'string',
          enum: codes,
          description: 'The best-fit candidate code, applying GRI 1-6 in order. It must match the code your reasoning_steps conclude with.',
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
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
        },
      },
      required: ['reasoning_steps', 'selected_code', 'ambiguous', 'ambiguous_alternatives', 'confidence'],
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
