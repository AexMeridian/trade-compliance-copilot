// Mirrors src/types/case.ts on the backend (Worker). Duplicated rather than
// imported across the package boundary since frontend/ and the root Worker
// are separate npm workspaces with no shared build step configured -- keep
// these two files in sync by hand if the CaseFile shape changes.

export type Direction = 'import' | 'export';
export type ModuleStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';
export type Confidence = 'high' | 'medium' | 'low';
export type Verdict = 'clear' | 'review_required' | 'stop';

export interface Provenance {
  source_url: string;
  source_tier: 1 | 2 | 3;
  last_updated: string;
  data_as_of?: string;
}

export interface ReasoningTrace {
  summary: string;
  steps: string[];
  cited_sources: Provenance[];
  confidence: Confidence;
}

export interface ClassificationCandidate {
  code: string;
  description: string;
  score: number;
}

export interface ClassificationResult {
  status: ModuleStatus;
  direction: Direction;
  product_description: string;
  candidates_considered: ClassificationCandidate[];
  selected_code: string | null;
  hs6: string | null;
  cross_reference_code: string | null;
  cross_reference_candidates: string[];
  ambiguous: boolean;
  ambiguous_alternatives: string[];
  reasoning: ReasoningTrace | null;
}

export interface OriginComponent {
  description: string;
  origin_country: string;
  value_pct: number | null;
}

export interface OriginResult {
  status: ModuleStatus;
  applicable_rule: { rule_id: number; rule_type: string; citation: string } | null;
  components: OriginComponent[];
  final_assembly_country: string | null;
  tariff_shift_met: boolean | null;
  rvc_calculated_pct: number | null;
  rvc_threshold_pct: number | null;
  qualifies: boolean | null;
  reasoning: ReasoningTrace | null;
}

export type PartyRole = 'buyer' | 'seller' | 'intermediary';
export type MatchVerdict = 'true_match' | 'false_positive' | 'inconclusive';

export interface PartyMatch {
  matched_entity_id: number;
  matched_list: string;
  matched_name: string;
  match_score: number;
  matched_fields: string[];
  verdict: MatchVerdict;
  risk_memo: string;
}

export interface PartyScreeningResult {
  role: PartyRole;
  input_name: string;
  matches: PartyMatch[];
}

export interface ScreeningResult {
  status: ModuleStatus;
  parties: PartyScreeningResult[];
  highest_severity: 'none' | 'caution' | 'hard_stop';
  hard_stop_triggered: boolean;
}

export interface DutyStackLine {
  layer: string;
  rate_pct: number | null;
  rate_type: string;
  legal_basis: string;
  effective_date: string;
  applies: boolean;
  reason_if_not_applied: string | null;
  caveat: string | null;
  source: Provenance | null;
}

export interface DeterminationResult {
  status: ModuleStatus;
  direction: Direction;
  duty_stack: DutyStackLine[] | null;
  landed_cost_estimate_pct: number | null;
  destination_country: string | null;
  eccn: string | null;
  reasons_for_control: string[] | null;
  license_requirement: 'NLR' | 'License Required' | 'License Exception May Apply' | 'Insufficient Data' | null;
  license_exception_candidates: string[] | null;
  denied_party_override: boolean;
  reasoning: ReasoningTrace | null;
  verdict: Verdict | null;
}

export interface CaseFile {
  id: string;
  direction: Direction;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_key: string | null;
  classification: ClassificationResult;
  origin: OriginResult;
  screening: ScreeningResult;
  determination: DeterminationResult;
  open_issues: string[];
}
