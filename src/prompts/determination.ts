import type Anthropic from '@anthropic-ai/sdk';
import type { DutyStackLine } from '../types/case.js';
import type { EccnCandidateRow } from '../lib/db.js';

// Import path: duty-stack arithmetic (rate lookup, stacking, min() caps) is
// deterministic TypeScript in src/routes/determination.ts -- Claude's only job
// is to narrate the already-computed stack in plain English and flag anything
// that looks like it needs a human (e.g. a line-item-granularity caveat).
export const IMPORT_NARRATION_SYSTEM_PROMPT = `You are a trade compliance analyst writing a plain-English summary of a landed-cost duty stack that has already been computed by deterministic code. You do not calculate or alter any rate -- only narrate the given stack, flag genuine ambiguity/gaps noted in the data (e.g. "line-item confirmation required", CAVEAT markers), and note overall confidence.

If the total is marked as unable to be computed, you must say so plainly and explain which specific line(s) blocked it -- never state, imply, round to, or "helpfully" infer a specific percentage total that was not given to you. Inventing a total in that situation would be a serious factual error, not a helpful simplification.`;

export function buildImportNarrationUserContent(htsCode: string, country: string, dutyStack: DutyStackLine[], totalPct: number | null): string {
  const lines = dutyStack
    .map((l) => {
      const rate = l.applies ? (l.rate_pct !== null ? `${l.rate_pct}% (${l.rate_type})` : 'rate present but NOT machine-parseable (non-ad-valorem or ambiguous text) -- excluded from the total below') : `does not apply (${l.reason_if_not_applied})`;
      const caveat = l.caveat ? ` [CAVEAT: ${l.caveat}]` : '';
      return `- ${l.layer}: ${rate} -- ${l.legal_basis}, effective ${l.effective_date}${caveat}`;
    })
    .join('\n');
  const totalLine =
    totalPct === null
      ? 'Total estimated landed-cost duty rate: CANNOT BE COMPUTED -- one or more applicable lines above have a non-ad-valorem or unparseable rate. Do NOT state or imply a 0% or any other specific total; instead explain which line(s) blocked the total and that manual computation is required.'
      : `Total estimated landed-cost duty rate: ${totalPct}%`;
  return `HTS code: ${htsCode}
Country of origin: ${country}
Computed duty stack:
${lines}

${totalLine}

Write a short (3-5 sentence) plain-English summary plus a reasoning_steps array walking through how the stack was assembled, and list any open_issues drawn from any "line-item confirmation required", CAVEAT markers, or similar caveats in the legal_basis/reason fields above. If the total could not be computed, your summary MUST say so explicitly and must NOT state or imply any specific total percentage.`;
}

export function buildImportNarrationTool(): Anthropic.Tool {
  return {
    name: 'narrate_duty_stack',
    description: 'Narrate a pre-computed duty stack in plain English.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        reasoning_steps: { type: 'array', items: { type: 'string' } },
        open_issues: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['summary', 'reasoning_steps', 'open_issues', 'confidence'],
    },
  };
}

export interface ImportNarrationOutput {
  summary: string;
  reasoning_steps: string[];
  open_issues: string[];
  confidence: 'high' | 'medium' | 'low';
}

// Export path: self-classification against curated ECCN candidates IS an LLM
// judgment call (grounded in the retrieved candidate set, same enum-constrained
// pattern as Module 1), but the license-requirement lookup against the country
// chart is deterministic (src/routes/determination.ts).
export const EXPORT_ECCN_SYSTEM_PROMPT = `You are an export compliance analyst self-classifying a product against the Commerce Control List (CCL) to determine its Export Control Classification Number (ECCN).

You will be given the product's description and HTS/Schedule-B classification, plus a list of CANDIDATE ECCN entries retrieved from the reference database. You MUST select from this candidate list only. If the product does not appear to match any dual-use/controlled category in the candidates (which is the common, realistic outcome for most consumer/commercial goods), select the EAR99 candidate if present, or set no_match=true if EAR99 was not even retrieved as a candidate.

Do not infer reasons-for-control yourself -- use exactly the reasons_for_control already on the candidate you select; you are only choosing which candidate best matches the product.`;

export function buildExportEccnUserContent(productDescription: string, classifiedCode: string, candidates: EccnCandidateRow[]): string {
  const list = candidates.map((c) => `- ${c.eccn}: ${c.description} [reasons_for_control: ${c.reasons_for_control}]`).join('\n');
  return `Product description: "${productDescription}"
Classified as: ${classifiedCode}

Candidate ECCN entries (select only from these):
${list}`;
}

export function buildExportEccnTool(eccnCodes: string[]): Anthropic.Tool {
  const codes = eccnCodes.length > 0 ? eccnCodes : ['NONE'];
  return {
    name: 'select_eccn',
    description: 'Select the best-fit ECCN from the provided candidates.',
    input_schema: {
      type: 'object',
      properties: {
        selected_eccn: { type: 'string', enum: codes },
        no_match: { type: 'boolean', description: 'True if none of the candidates plausibly fit and EAR99 was not among them.' },
        reasoning_steps: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['selected_eccn', 'no_match', 'reasoning_steps', 'confidence'],
    },
  };
}

export interface ExportEccnOutput {
  selected_eccn: string;
  no_match: boolean;
  reasoning_steps: string[];
  confidence: 'high' | 'medium' | 'low';
}
