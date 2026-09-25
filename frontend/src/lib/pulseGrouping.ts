import type { PulseAction } from '../types/pulse';

export interface PulseGroup {
  title: string;
  tag: PulseAction['tag'];
  agency: string;
  items: PulseAction[];
}

// The Federal Register API's title/abstract fields are themselves generic
// boilerplate for some high-volume notice types -- verified against real
// data: every "Notice of OFAC Sanctions Action" entry (181 of them in one
// sync) carries the exact same templated abstract text with no named
// entity, because the actual designee names live only in the linked
// document itself, not in the API metadata this feed reads. Grouping by
// title is therefore also the right signal for "this is a routine,
// templated notice type" vs. "this is a standalone, individually-titled
// action" -- used both to collapse the feed (PulseFeedList) and to decide
// what's worth surfacing as a headline signal (PulseTopSignals).
export function groupByTitle(actions: PulseAction[]): PulseGroup[] {
  const order: string[] = [];
  const byTitle = new Map<string, PulseAction[]>();
  for (const a of actions) {
    if (!byTitle.has(a.title)) {
      order.push(a.title);
      byTitle.set(a.title, []);
    }
    byTitle.get(a.title)!.push(a);
  }
  return order.map((title) => {
    const items = byTitle.get(title)!;
    return { title, tag: items[0].tag, agency: items[0].agency, items };
  });
}

// Rough substantive-weight ordering for Federal Register document types --
// a Presidential proclamation or a final Rule changes something; the vast
// majority of Notices are routine/procedural (administrative reviews,
// scope rulings, sanctions-list updates). Not a claim about legal effect,
// just a deterministic tiebreaker for "what's worth surfacing first,"
// same spirit as the duty-stack module's plain-TypeScript math elsewhere
// in this app -- no model call, no invented score.
const DOC_TYPE_WEIGHT: Record<string, number> = {
  'Presidential Document': 4,
  Rule: 3,
  'Proposed Rule': 2,
  Notice: 1,
};

export function docTypeWeight(docType: string): number {
  return DOC_TYPE_WEIGHT[docType] ?? 1;
}
