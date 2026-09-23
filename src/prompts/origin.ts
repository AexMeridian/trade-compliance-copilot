import type Anthropic from '@anthropic-ai/sdk';
import type { UsmcaRuleRow } from '../lib/db.js';
import type { OriginComponent } from '../types/case.js';

export const ORIGIN_SYSTEM_PROMPT = `You are a trade compliance analyst determining USMCA (United States-Mexico-Canada Agreement) preferential origin eligibility for a product, per HTSUS General Note 11.

You will be given the product's classified HTS/Schedule-B heading, the ONE curated origin rule retrieved from the reference database for that heading (tariff-shift requirement and/or regional value content (RVC) threshold, with its method and citation), and the user's component sourcing / final assembly facts.

Reason step by step:
1. Restate the applicable rule type (tariff shift, RVC, or both) and threshold from the data given -- do not use any threshold or rule text not present in the data provided to you.
2. If a tariff-shift rule applies, assess whether the non-originating inputs described appear to satisfy the required tariff classification change, given the facts provided. If the facts are insufficient to determine this with confidence, say so explicitly rather than guessing.
3. If an RVC rule applies, calculate an approximate RVC percentage from the component value_pct figures given (treat any component whose origin_country is US, Canada, or Mexico as originating value; everything else as non-originating), and compare it to the threshold. Show the arithmetic.
4. State your qualifies determination (true/false), or explicitly say the facts are insufficient to determine (in which case qualifies must be false and you must explain exactly what additional fact would resolve it) -- never guess when data is missing.
5. Note any real, load-bearing USMCA requirements mentioned in the rule's notes field that this app does not numerically model (e.g. automotive labor value content, steel/aluminum purchasing requirements) as open issues a human analyst must still check.`;

export function buildOriginUserContent(
  code: string,
  rule: UsmcaRuleRow,
  components: OriginComponent[],
  finalAssemblyCountry: string
): string {
  const componentLines = components
    .map((comp) => `- ${comp.description}: sourced from ${comp.origin_country}, ${comp.value_pct ?? 'unknown'}% of value`)
    .join('\n');
  return `Classified heading: ${code}

Curated USMCA rule for this heading (from General Note 11, do not use any other rule):
- rule_type: ${rule.rule_type}
- tariff_shift_text: ${rule.tariff_shift_text ?? '(not applicable to this rule)'}
- rvc_threshold_pct: ${rule.rvc_threshold_pct ?? '(not applicable)'}
- rvc_method: ${rule.rvc_method ?? '(not applicable)'}
- de_minimis_pct: ${rule.de_minimis_pct ?? '(not applicable)'}
- citation: ${rule.citation}
- notes: ${rule.notes ?? '(none)'}

Final assembly country: ${finalAssemblyCountry}

Components:
${componentLines || '(no components provided)'}`;
}

export function buildOriginTool(): Anthropic.Tool {
  return {
    name: 'assess_origin',
    description: 'Assess USMCA origin qualification strictly from the provided rule and component facts.',
    input_schema: {
      type: 'object',
      properties: {
        tariff_shift_met: {
          type: ['boolean', 'null'],
          description: 'Whether the tariff-shift requirement appears met, or null if not applicable to this rule.',
        },
        rvc_calculated_pct: {
          type: ['number', 'null'],
          description: 'Calculated RVC percentage from the given component values, or null if not applicable.',
        },
        qualifies: {
          type: 'boolean',
          description: 'True only if the rule is clearly met by the given facts. False if not met OR if facts are insufficient to determine.',
        },
        insufficient_facts: {
          type: 'boolean',
          description: 'True if qualifies=false specifically because the given facts are insufficient (not because the rule is clearly failed).',
        },
        reasoning_steps: {
          type: 'array',
          items: { type: 'string' },
        },
        open_issues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Real USMCA requirements from the rule notes that this app does not numerically model, if any.',
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['tariff_shift_met', 'rvc_calculated_pct', 'qualifies', 'insufficient_facts', 'reasoning_steps', 'open_issues', 'confidence'],
    },
  };
}

export interface OriginToolOutput {
  tariff_shift_met: boolean | null;
  rvc_calculated_pct: number | null;
  qualifies: boolean;
  insufficient_facts: boolean;
  reasoning_steps: string[];
  open_issues: string[];
  confidence: 'high' | 'medium' | 'low';
}
