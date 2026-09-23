// Shared CaseFile contract: every module route reads its prerequisites from this
// object and writes only its own section back. Persisted as a single JSON blob in
// D1's `cases.case_file` column (see migrations/0004_schema_cases.sql) -- see
// src/lib/caseStore.ts for the read-whole/write-whole persistence helpers.

export type Direction = 'import' | 'export';
export type ModuleStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';
export type Confidence = 'high' | 'medium' | 'low';
export type Verdict = 'clear' | 'review_required' | 'stop';

export interface Provenance {
  source_url: string;
  source_tier: 1 | 2 | 3;
  last_updated: string; // ISO date
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
  selected_code: string | null; // MUST be one of candidates_considered[].code -- never freeform
  hs6: string | null;
  cross_reference_code: string | null; // Schedule B code if import, HTS code if export
  cross_reference_candidates: string[]; // other codes sharing the same HS-6, for the UI's cross-reference panel
  ambiguous: boolean;
  ambiguous_alternatives: string[];
  reasoning: ReasoningTrace | null;
}

export interface OriginComponent {
  description: string;
  origin_country: string; // ISO 3166-1 alpha-2
  value_pct: number | null;
}

export interface OriginResult {
  status: ModuleStatus;
  applicable_rule: {
    rule_id: number;
    rule_type: string;
    citation: string;
  } | null; // null when the heading isn't curated -- must render "not curated" in the UI, never guessed
  components: OriginComponent[];
  final_assembly_country: string | null;
  tariff_shift_met: boolean | null;
  rvc_calculated_pct: number | null;
  rvc_threshold_pct: number | null;
  qualifies: boolean | null; // null = indeterminate, distinct from false
  reasoning: ReasoningTrace | null;
}

export type PartyRole = 'buyer' | 'seller' | 'intermediary';
export type MatchVerdict = 'true_match' | 'false_positive' | 'inconclusive';

export interface PartyMatch {
  matched_entity_id: number;
  matched_list: 'SDN' | string; // string covers csl_entries.source_list values (Entity List, Denied Persons List, ...)
  matched_name: string;
  match_score: number; // 0-1
  matched_fields: string[]; // e.g. ["alias: 'OOO Vostok'", "DOB: 10 Dec 1948"]
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
  hard_stop_triggered: boolean; // export direction + Entity List/Denied Persons true_match
}

export interface DutyStackLine {
  layer: string; // "HTS Column 1 General" | "Section 301 Forced Labor" | ...
  rate_pct: number | null;
  rate_type: string;
  legal_basis: string;
  effective_date: string;
  applies: boolean;
  reason_if_not_applied: string | null;
  caveat: string | null; // scope/precision caveats (e.g. "chapter-level approximation, line-item confirmation required") shown regardless of applies
  source: Provenance | null;
}

export interface DeterminationResult {
  status: ModuleStatus;
  direction: Direction;
  // import branch: uses origin.final_assembly_country as country of origin for overlay lookups
  duty_stack: DutyStackLine[] | null;
  landed_cost_estimate_pct: number | null;
  // export branch: destination is a distinct concept from origin.final_assembly_country
  // (an exported good's origin/assembly country and the country it ships TO are not the
  // same field), so it's collected at determination time rather than reusing Module 2's data.
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

export function emptyCaseFile(id: string, direction: Direction): CaseFile {
  const now = new Date().toISOString();
  return {
    id,
    direction,
    created_at: now,
    updated_at: now,
    is_sample: false,
    sample_key: null,
    classification: {
      status: 'not_started',
      direction,
      product_description: '',
      candidates_considered: [],
      selected_code: null,
      hs6: null,
      cross_reference_code: null,
      cross_reference_candidates: [],
      ambiguous: false,
      ambiguous_alternatives: [],
      reasoning: null,
    },
    origin: {
      status: 'not_started',
      applicable_rule: null,
      components: [],
      final_assembly_country: null,
      tariff_shift_met: null,
      rvc_calculated_pct: null,
      rvc_threshold_pct: null,
      qualifies: null,
      reasoning: null,
    },
    screening: {
      status: 'not_started',
      parties: [],
      highest_severity: 'none',
      hard_stop_triggered: false,
    },
    determination: {
      status: 'not_started',
      direction,
      duty_stack: null,
      landed_cost_estimate_pct: null,
      destination_country: null,
      eccn: null,
      reasons_for_control: null,
      license_requirement: null,
      license_exception_candidates: null,
      denied_party_override: false,
      reasoning: null,
      verdict: null,
    },
    open_issues: [],
  };
}
