// The regional-value-content arithmetic of a USMCA rule, done in code. When every component has a value and the values add up to the whole,
// the share from the three USMCA countries is a sum, and comparing it to the rule's threshold needs no judgment, so these cases are settled
// here and never sent to the model (which sometimes answered "insufficient" for them). Anything that needs a reading of the facts (a tariff
// shift, textile stages, missing values) still goes to the model.
import type { UsmcaRuleRow } from './db.js';
import type { OriginComponent } from '../types/case.js';

const USMCA = new Set(['US', 'CA', 'MX']);

export interface RvcPrecheck {
  qualifies: boolean;
  rvc_pct: number;
  summary: string;
  steps: string[];
}

export function precheckRvc(rule: Pick<UsmcaRuleRow, 'rule_type' | 'rvc_threshold_pct' | 'rvc_method' | 'citation'>, components: OriginComponent[]): RvcPrecheck | null {
  const threshold = rule.rvc_threshold_pct;
  if (threshold === null || (rule.rule_type !== 'rvc' && rule.rule_type !== 'tariff_shift_or_rvc')) return null;
  if (components.length === 0 || components.some((c) => typeof c.value_pct !== 'number' || !Number.isFinite(c.value_pct) || c.value_pct < 0)) return null;
  const total = components.reduce((sum, c) => sum + (c.value_pct as number), 0);
  if (Math.abs(total - 100) > 0.5) return null; // shares that do not add up to the whole cannot be compared to a threshold
  const originating = Math.round(components.filter((c) => USMCA.has(c.origin_country.toUpperCase())).reduce((sum, c) => sum + (c.value_pct as number), 0) * 100) / 100;
  const met = originating >= threshold;
  // A rule that accepts a tariff shift as an alternative cannot be failed on value alone.
  if (!met && rule.rule_type === 'tariff_shift_or_rvc') return null;
  const method = rule.rvc_method === 'net_cost' ? 'net cost' : rule.rvc_method === 'transaction_value' ? 'transaction value' : 'the stated value shares';
  return {
    qualifies: met,
    rvc_pct: originating,
    summary: met
      ? `Meets the regional value content test under ${rule.citation}: ${originating}% against a ${threshold}% threshold.`
      : `Does not meet the regional value content test under ${rule.citation}: ${originating}% against a ${threshold}% threshold.`,
    steps: [
      `Rule: ${rule.rule_type === 'rvc' ? 'regional value content only' : 'tariff shift or regional value content'}, ${threshold}% (${method}).`,
      `Components from the United States, Canada or Mexico add up to ${originating}% of value; the threshold is ${threshold}%.`,
      met ? `${originating} is at least ${threshold}, so the test is met.` : `${originating} is below ${threshold}, and this rule has no other route, so the test is not met.`,
      'Value shares are taken as given; a real certification uses the net cost or transaction value figures from the producer.',
    ],
  };
}
