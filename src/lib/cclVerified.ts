// The ECCNs re-derived from the eCFR by hand (migration 0032) and kept authoritative: the generated Commerce Control List load never overwrites their
// reasons for control, license exceptions or description. Their reasons are repeated here so scripts/build-ccl.ts can report where the parser
// disagrees with them, and tests/ccl-parse.test.ts checks this list against migration 0032 so the two cannot drift.
export const HAND_VERIFIED_REASONS: Record<string, string[]> = {
  '3A001': ['NS2', 'NS1?', 'RS1?', 'RS?', 'MT1?', 'NP1?', 'AT1'],
  '3A090': ['RS?', 'AT1'],
  '4A003': ['NS1?', 'NS2?', 'RS?', 'CC1?', 'AT1'],
  '4A090': ['RS?', 'AT1'],
  '5A002': ['NS1', 'RS?', 'AT1', 'EI?'],
  '5D002': ['NS1', 'RS?', 'AT1', 'EI?'],
  '5A992': ['RS?', 'AT1'],
  '6A003': ['NS2', 'NP1?', 'RS1?', 'RS2?', 'AT1', 'UN?'],
  '1C350': ['CB2', 'CW?', 'AT?'],
};
