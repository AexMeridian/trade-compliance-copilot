// Screening policy kept apart from the route so it can be tested without a database or a model call.
// Documented policy:
//   hard stop on any direction ... OFAC SDN, OFAC Foreign Sanctions Evaders (U.S. persons are prohibited from dealing with them);
//   hard stop on export only ...... BIS Entity List, BIS Denied Persons List, UN Security Council list, State Department ITAR/AECA debarred parties
//                                   (on an import these are a caution);
//   caution, with its own message . BIS Unverified List (15 CFR 744.15: no license exceptions, UVL statement needed), Military End User list,
//                                   CAPTA (correspondent/payable-through account restrictions), and every other CSL or UK listing.
// A true match is whatever the model judged to be one; the floor below stops the model from clearing a close SDN name on its own.
import type { MatchVerdict } from '../types/case.js';

export const SDN_FLOOR_SCORE = 0.85;

export type ListKind = 'sdn' | 'fse' | 'entity_dpl' | 'itar_debarred' | 'un' | 'uvl' | 'meu' | 'capta' | 'uk' | 'other';

export function listKind(source: 'SDN' | 'CSL' | 'UN' | 'UK', matchedList: string): ListKind {
  if (source === 'SDN') return 'sdn';
  if (source === 'UN') return 'un';
  if (source === 'UK') return 'uk';
  const l = matchedList.toLowerCase();
  if (l.includes('foreign sanctions evaders')) return 'fse';
  if (l.includes('entity list') || l.includes('denied persons')) return 'entity_dpl';
  if (l.includes('debarred')) return 'itar_debarred';
  if (l.includes('unverified list')) return 'uvl';
  if (l.includes('military end user')) return 'meu';
  if (l.includes('capta')) return 'capta';
  return 'other';
}

/** A model "false positive" on an OFAC SDN candidate with a near-identical name is kept as inconclusive: a model reading a name alone may not clear a blocked person. */
export function floorVerdict(source: string, score: number, verdict: MatchVerdict): { verdict: MatchVerdict; floored: boolean } {
  if (source === 'SDN' && score >= SDN_FLOOR_SCORE && verdict === 'false_positive') return { verdict: 'inconclusive', floored: true };
  return { verdict, floored: false };
}

export const SDN_FLOOR_NOTE =
  'Kept as inconclusive: the name is a near match to an OFAC SDN entry (similarity 0.85 or higher), and a name-only model judgment is not allowed to clear it. Confirm with the party\'s full legal name, address, date of birth or other identifiers, or the official OFAC search.';

export interface SeverityInput {
  direction: 'import' | 'export';
  trueKinds: ListKind[];
  anyInconclusive: boolean;
  /** Any sanctions list stale, empty, or failing to refresh. */
  listsNotCurrent: boolean;
}

export function decideSeverity(i: SeverityInput): { severity: 'none' | 'caution' | 'hard_stop'; hardStop: boolean } {
  const k = i.trueKinds;
  const hardStop = k.includes('sdn') || k.includes('fse') || (i.direction === 'export' && (k.includes('entity_dpl') || k.includes('un') || k.includes('itar_debarred')));
  if (hardStop) return { severity: 'hard_stop', hardStop: true };
  return { severity: k.length > 0 || i.anyInconclusive || i.listsNotCurrent ? 'caution' : 'none', hardStop: false };
}
