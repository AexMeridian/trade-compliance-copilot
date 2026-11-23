// Reads Country Groups (15 CFR Part 740, Supplement No. 1) from the eCFR's XML: Groups A (A:1-A:6), D (D:1-D:5) and E (E:1, E:2) are tables with an X
// per member, Group B is a plain list, Group C is reserved. Pure (no network); scripts/build-country-groups.ts downloads and writes the migration.
import { CHART_NAME_TO_ISO } from './chartNames.js';

export interface GroupMember {
  /** "A:1", "D:5", "B" ... */
  group: string;
  name: string;
}

/** The label the eCFR gives each group, for display. Keys are the group codes this parser emits. */
export const GROUP_LABEL: Record<string, string> = {
  'A:1': 'Wassenaar Arrangement participating states',
  'A:2': 'Missile Technology Control Regime',
  'A:3': 'Australia Group',
  'A:4': 'Nuclear Suppliers Group',
  'A:5': 'Close allies with broad license-exception eligibility (A:5)',
  'A:6': 'Additional license-exception eligibility group (A:6)',
  B: 'Country Group B',
  'D:1': 'National security',
  'D:2': 'Nuclear',
  'D:3': 'Chemical and biological',
  'D:4': 'Missile technology',
  'D:5': 'U.S. arms embargoed countries',
  'E:1': 'Terrorist supporting countries',
  'E:2': 'Unilateral embargo',
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const clean = (html: string) =>
  html
    .replace(/<br\s*\/?>(<\/br>)?/gi, ' ')
    .replace(/<sup>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, n: string) => ENTITIES[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim();

/** Names the groups tables spell differently from the Country Chart (see chartNames.ts). */
const ALIAS: Record<string, string> = {
  'China (PRC)': 'CN', 'Congo (Democratic Republic of)': 'CD', 'The Bahamas': 'BS', 'Bosnia & Herzegovina': 'BA', "Cote d'lvoire": 'CI', "Cote d'Ivoire": 'CI',
  'Saint Kitts & Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent and the Grenadines': 'VC', 'Sao Tome & Principe': 'ST', 'Trinidad & Tobago': 'TT',
  'Micronesia, Federated States of': 'FM', Seychelles: 'SC', 'Hong Kong': 'HK', Turkey: 'TR', 'United States': 'US', Burma: 'MM',
  'Korea, South': 'KR', 'Korea, North': 'KP', 'Vatican City': 'VA', 'Cape Verde': 'CV', Kosovo: 'XK',
};

export function groupCountryIso(name: string): string | null {
  return ALIAS[name] ?? CHART_NAME_TO_ISO[name] ?? (name === 'United States' ? 'US' : null);
}

/** Every (group, country name) membership in the supplement. Throws when the layout is not the one this parser knows. */
export function parseCountryGroups(xml: string, requireAllGroups = true): GroupMember[] {
  const out: GroupMember[] = [];
  for (const t of xml.matchAll(/<TABLE[\s\S]*?<\/TABLE>/g)) {
    const table = t[0];
    const rows = [...table.matchAll(/<TR>([\s\S]*?)<\/TR>/g)].map((m) => [...m[1].matchAll(/<T([DH])[^>]*>([\s\S]*?)<\/T[DH]>/g)].map((c) => ({ th: c[1] === 'H', text: clean(c[2]) })));
    const head = rows.find((r) => r.length > 1 && r.every((c) => c.th));
    if (!head) continue;
    const codes = head.slice(1).map((c) => /\[\s*([A-E])\s*:\s*(\d)\s*\]/.exec(c.text)).map((m) => (m ? `${m[1]}:${m[2]}` : null));
    if (codes.some((c) => c === null) || codes.length === 0) throw new Error(`Country Groups table header not recognised: ${head.map((c) => c.text).join(' | ')}`);
    for (const r of rows) {
      if (r.some((c) => c.th) || r.length !== codes.length + 1) continue; // footnotes are single wide cells
      r.slice(1).forEach((c, i) => {
        if (c.text.toUpperCase() === 'X') out.push({ group: codes[i]!, name: r[0].text });
      });
    }
  }
  const b = xml.indexOf('Country Group B');
  const bList = b >= 0 ? /<SCOL2>([\s\S]*?)<\/SCOL2>/.exec(xml.slice(b)) : null;
  if (!bList) throw new Error('Country Group B list not found in the Country Groups XML');
  for (const li of bList[1].matchAll(/<LI>([\s\S]*?)<\/LI>/g)) out.push({ group: 'B', name: clean(li[1]) });
  const groups = new Set(out.map((m) => m.group));
  if (requireAllGroups) for (const g of Object.keys(GROUP_LABEL)) if (!groups.has(g)) throw new Error(`Country Group ${g} has no members in the parsed XML; the layout may have changed`);
  return out;
}
