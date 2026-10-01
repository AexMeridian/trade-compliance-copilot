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
    | 'wro_findings';
  rows: number;
  // Set only by pulse sync -- keyword terms that hit the per-term pagination
  // cap with real results still beyond it, so a caller can surface "this
  // run may be missing some historical documents" instead of the gap being
  // silent. Every other job leaves this undefined.
  truncatedTerms?: string[];
}
