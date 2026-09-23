import type Anthropic from '@anthropic-ai/sdk';

export const SCREENING_SYSTEM_PROMPT = `You are a trade compliance analyst writing a plain-English risk memo for potential denied-party matches.

You will be given an input party name and a shortlist of candidate matches, each already fuzzy-scored by a deterministic algorithm (token-sort + Jaro-Winkler, ran outside your reasoning) against the OFAC Specially Designated Nationals (SDN) list or the BIS/State Consolidated Screening List. Your job is NOT to re-score the string similarity -- that score is given to you as a fact. Your job is to judge, for each candidate, whether this is:
- "true_match": the input name plausibly refers to the same real party as the candidate, considering the score and any corroborating fields (DOB, address, alias type, program).
- "false_positive": the string similarity is coincidental (e.g. a common short name, a generic word) and there is no reasonable basis to believe this is the same party.
- "inconclusive": the name similarity is meaningful but there isn't enough corroborating detail (no DOB/address given, or a very common name) to confidently call it either way.

For every candidate, write a short risk_memo (2-4 sentences) that explicitly cites which fields you're reasoning from -- e.g. "Matched via alias 'OOO VOSTOK' (weak a.k.a.); no DOB or address was provided for the input party to corroborate or rule out." Never assert a fact (DOB, address, program) that was not given to you in the candidate data.

You must produce exactly one assessment per candidate provided, using its candidate_ref exactly as given.`;

export interface ScreeningCandidateForPrompt {
  candidate_ref: string;
  source: 'SDN' | 'CSL';
  matched_name: string;
  match_score: number;
  matched_via: 'primary_name' | 'alias';
  entity_type_or_source_list: string | null;
  dob: string | null;
  addresses: string | null;
  programs_or_remarks: string | null;
}

export function buildScreeningUserContent(inputName: string, role: string, candidates: ScreeningCandidateForPrompt[]): string {
  const list = candidates
    .map(
      (cand) =>
        `- candidate_ref: ${cand.candidate_ref}\n  source: ${cand.source} (${cand.entity_type_or_source_list ?? 'unknown type'})\n  matched name: "${cand.matched_name}" (matched via ${cand.matched_via}, fuzzy score ${cand.match_score.toFixed(3)})\n  DOB: ${cand.dob ?? '(not on record)'}\n  addresses: ${cand.addresses ?? '(not on record)'}\n  programs/remarks: ${cand.programs_or_remarks ?? '(none)'}`
    )
    .join('\n\n');
  return `Input party name: "${inputName}" (role: ${role})

Candidate matches (pre-filtered and fuzzy-scored deterministically -- assess each one):

${list}`;
}

export function buildScreeningTool(candidateRefs: string[]): Anthropic.Tool {
  return {
    name: 'assess_party_matches',
    description: 'Assess each candidate denied-party match and write a risk memo.',
    input_schema: {
      type: 'object',
      properties: {
        assessments: {
          type: 'array',
          minItems: candidateRefs.length,
          maxItems: candidateRefs.length,
          items: {
            type: 'object',
            properties: {
              candidate_ref: { type: 'string', enum: candidateRefs },
              verdict: { type: 'string', enum: ['true_match', 'false_positive', 'inconclusive'] },
              matched_fields: { type: 'array', items: { type: 'string' } },
              risk_memo: { type: 'string' },
            },
            required: ['candidate_ref', 'verdict', 'matched_fields', 'risk_memo'],
          },
        },
      },
      required: ['assessments'],
    },
  };
}

export interface ScreeningToolOutput {
  assessments: {
    candidate_ref: string;
    verdict: 'true_match' | 'false_positive' | 'inconclusive';
    matched_fields: string[];
    risk_memo: string;
  }[];
}
