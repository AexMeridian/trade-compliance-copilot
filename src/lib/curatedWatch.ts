// Detect-and-flag for the hand-verified tables (tariff overlays, USMCA rules, Country Chart and ECCN, CBP user fees). A notice about one of
// these programs that is newer than the program's data cannot change a rate by itself, but it means the figures may be out of date, so the
// calculator says so on every case the program touches. The matching is plain pattern work on titles and abstracts the daily Pulse sync
// already stored: no network, no model.

export type CuratedProgram = 'sec232' | 'sec301' | 'sec338' | 'usmca' | 'export_controls' | 'customs_fees';

export const PROGRAM_LABEL: Record<CuratedProgram, string> = {
  sec232: 'Section 232 duties',
  sec301: 'Section 301 duties',
  sec338: 'Section 338 duties on Canada',
  usmca: 'USMCA rules of origin',
  export_controls: 'export control rules',
  customs_fees: 'CBP user fees',
};

export interface WatchedAction {
  document_number: string;
  title: string;
  abstract: string | null;
  agency: string;
  doc_type: string;
  publication_date: string;
  effective_on: string | null;
  html_url: string;
}

// Entity List, Denied Persons and Military End User changes arrive through the sanctions refresh, so they are not alerts here.
const LIST_ONLY_RE = /\b(entity list|denied persons?|unverified list|military end[- ]user|military-intelligence end)/i;
// Antidumping and countervailing-duty cases are a different program; they say "aluminum" or "steel" without being Section 232.
const AD_CVD_RE = /anti-?dumping|countervailing|five-year|sunset review|administrative review/i;
const EXPORT_RULE_RE = /commerce control list|country chart|export administration regulations|license (requirements?|exceptions?)|part 74[0-9]|supplement no\. \d+ to part|ECCN|export controls? (on|for)|controls on/i;

export function programsFor(a: WatchedAction): CuratedProgram[] {
  if (a.doc_type === 'PROPOSED_RULE') return [];
  const text = `${a.title} ${a.abstract ?? ''}`;
  const out: CuratedProgram[] = [];
  if (!AD_CVD_RE.test(a.title) && /section 232|adjusting imports of|(aluminum|steel|copper)[^.]{0,40}(tariff regime|inclusions?)|derivative (steel|aluminum|copper)/i.test(text)) out.push('sec232');
  if (/section 301/i.test(text)) out.push('sec301');
  if (/section 338/i.test(text)) out.push('sec338');
  if (/USMCA|united states-mexico-canada/i.test(text) && !/binational panel|panel review/i.test(a.title)) out.push('usmca');
  if (/customs user fees|merchandise processing fee|harbor maintenance fee/i.test(text)) out.push('customs_fees');
  if (/bureau of industry and security/i.test(a.agency) && EXPORT_RULE_RE.test(text) && !(LIST_ONLY_RE.test(a.title) && !/commerce control list|country chart|license requirement/i.test(text))) out.push('export_controls');
  return out;
}

export interface NewAlert {
  document_number: string;
  program: CuratedProgram;
  title: string;
  publication_date: string;
  effective_on: string | null;
  html_url: string;
}

/**
 * Alerts for notices published after a program's data was last verified. `baselines` maps each program to its data_as_of (YYYY-MM-DD);
 * a program without a baseline is skipped (no data of that kind is loaded, so there is nothing to be out of date). `known` is the set of
 * "document_number:program" pairs already stored.
 */
export function findNewAlerts(actions: WatchedAction[], baselines: Partial<Record<CuratedProgram, string>>, known: Set<string>): NewAlert[] {
  const out: NewAlert[] = [];
  for (const a of actions) {
    for (const program of programsFor(a)) {
      const baseline = baselines[program];
      if (!baseline || a.publication_date <= baseline) continue;
      if (known.has(`${a.document_number}:${program}`)) continue;
      out.push({ document_number: `${a.document_number}`, program, title: a.title, publication_date: a.publication_date, effective_on: a.effective_on, html_url: a.html_url });
    }
  }
  return out;
}

export interface StaleCheck {
  program: string;
  dataAsOf: string;
  ageDays: number;
  level: 'ok' | 'aging' | 'stale';
}

export const AGING_AFTER_DAYS = 45;
export const STALE_AFTER_DAYS = 90;

export function staleness(program: string, dataAsOf: string, today: string): StaleCheck {
  const ageDays = Math.max(0, Math.floor((Date.parse(today) - Date.parse(dataAsOf)) / 86_400_000));
  return { program, dataAsOf, ageDays, level: ageDays > STALE_AFTER_DAYS ? 'stale' : ageDays > AGING_AFTER_DAYS ? 'aging' : 'ok' };
}

/** The programs a case touches, from the overlay rows that applied to it, so only relevant alerts are shown. */
export function programsForOverlays(overlayPrograms: string[], country: string): CuratedProgram[] {
  const out = new Set<CuratedProgram>();
  for (const p of overlayPrograms) {
    if (p.startsWith('sec232')) out.add('sec232');
    else if (p.startsWith('sec301')) out.add('sec301');
    else if (p.startsWith('sec338')) out.add('sec338');
  }
  if (country === 'CA' || country === 'MX') out.add('usmca');
  if (country === 'CN') out.add('sec301');
  return [...out];
}

/** One open-issue sentence per program with pending notices, naming up to three of them. */
export function describeAlerts(alerts: { program: CuratedProgram; title: string; publication_date: string; html_url: string }[]): string[] {
  const byProgram = new Map<CuratedProgram, typeof alerts>();
  for (const a of alerts) byProgram.set(a.program, [...(byProgram.get(a.program) ?? []), a]);
  return [...byProgram.entries()].map(([program, list]) => {
    const shown = list.slice(0, 3).map((a) => `"${a.title.slice(0, 110)}" (${a.publication_date}, ${a.html_url})`).join('; ');
    const more = list.length > 3 ? ` and ${list.length - 3} more` : '';
    return `Determination: ${list.length} Federal Register notice${list.length === 1 ? '' : 's'} on ${PROGRAM_LABEL[program]} ${list.length === 1 ? 'was' : 'were'} published after this app's ${PROGRAM_LABEL[program]} data was last verified: ${shown}${more}. The figures here may be out of date until that data is reviewed.`;
  });
}
