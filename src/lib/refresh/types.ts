export interface RefreshResult {
  source:
    | 'hts'
    | 'schedule_b'
    | 'xref'
    | 'sdn'
    | 'csl'
    | 'un_sanctions'
    | 'uk_sanctions'
    | 'pulse'
    | 'pulse_fx'
    | 'pulse_quotes'
    | 'pulse_news'
    | 'pulse_macro'
    | 'pulse_cofer'
    | 'gta'
    | 'wro_findings'
    | 'case_expiry';
  rows: number;
  // Set when a bulk job found its upstream file identical to the last load and skipped the
  // (write-heavy) table rewrite. rows is 0 in that case.
  unchanged?: boolean;
  // Set only by pulse sync -- keyword terms that hit the per-term pagination
  // cap with real results still beyond it, so a caller can surface "this
  // run may be missing some historical documents" instead of the gap being
  // silent. Every other job leaves this undefined.
  truncatedTerms?: string[];
}
