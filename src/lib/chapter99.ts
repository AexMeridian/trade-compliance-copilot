// Chapter 99 (subchapter III) heading numbers shown on duty layers, e.g. "9903.88.03". A heading is attached only where the layer's own
// data names it or the mapping is one-to-one:
//   - China Section 301 rows carry "HTSUS heading 9903.xx.xx" in their legal basis (loaded from the HTS chapter 99 lines), so the heading
//     is read from there.
//   - Section 232 automobiles on a passenger-vehicle line (8703): heading 9903.94.01, the base heading for the 25% rate this app models
//     (trade-deal origins use other 9903.94 lines, which the layer's caveat already says).
// Everything else is left without a number on purpose: the Section 232 metals lines (9903.82.xx) are split by metal, country and content
// share and the overlay table does not carry that split; the forced-labor Section 301 lines (9903.06 and others) are per economy and the
// loaded rows do not name them. A wrong number on a customs entry is worse than none. Verified headings: data/chapter99-headings.json
// (USITC HTS, fetched 2026-11-22), checked by tests/chapter99.test.ts.
import type { DutyStackLine } from '../types/case.js';

const HEADING = /\b(9903\.\d{2}\.\d{2})\b/;

/** Chapter 99 headings for one duty layer, or [] when the mapping is not certain. `htsDigits` is the product's HTS code, digits only. */
export function chapter99Headings(line: Pick<DutyStackLine, 'layer' | 'legal_basis'>, htsDigits: string): string[] {
  if (/^Section 301 \(China/.test(line.layer)) {
    const m = /HTSUS heading (9903\.\d{2}\.\d{2})/.exec(line.legal_basis);
    return m ? [m[1]] : [];
  }
  if (line.layer === 'Section 232 (autos)' && htsDigits.startsWith('8703')) return ['9903.94.01'];
  return [];
}

/** Sets `chapter99` on each layer that has a certain mapping. */
export function annotateChapter99(lines: DutyStackLine[], htsDigits: string): DutyStackLine[] {
  for (const l of lines) {
    const h = chapter99Headings(l, htsDigits);
    if (h.length) l.chapter99 = h;
  }
  return lines;
}

export const isChapter99Heading = (s: string) => HEADING.test(s);
