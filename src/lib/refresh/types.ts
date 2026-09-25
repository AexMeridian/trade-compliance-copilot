export interface RefreshResult {
  source: 'hts' | 'schedule_b' | 'xref' | 'sdn' | 'csl' | 'pulse';
  rows: number;
  // Set only by pulse sync -- keyword terms that hit the per-term pagination
  // cap with real results still beyond it, so a caller can surface "this
  // run may be missing some historical documents" instead of the gap being
  // silent. Every other job leaves this undefined.
  truncatedTerms?: string[];
}
