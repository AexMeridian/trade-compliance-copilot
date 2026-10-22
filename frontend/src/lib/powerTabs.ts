export interface TabDef<T extends string> {
  id: T;
  label: string;
  hint: string;
  /** Tailwind border color class for the active underline. */
  border?: string;
}

// The two power pages and how the old pages' tab links map onto them (used by the app's redirects and the Worker's 301s).
export type HardTabId = 'overview' | 'trade' | 'sanctions' | 'money' | 'military' | 'compare' | 'guide';
export type SoftTabId = 'scoreboard' | 'overview' | 'attitudes' | 'culture' | 'values' | 'foreign' | 'compare' | 'method';

export const HARD_TABS: TabDef<HardTabId>[] = [
  { id: 'overview', label: 'Overview', hint: 'The short version', border: 'border-ink' },
  { id: 'trade', label: 'Trade tools', hint: 'Tariffs, export controls and the notices behind them', border: 'border-hue-orange' },
  { id: 'sanctions', label: 'Sanctions', hint: 'Browse the OFAC and Commerce/State sanctioned-entity lists by country', border: 'border-hue-violet' },
  { id: 'money', label: 'Money & dollar', hint: "The dollar's reserve share, who holds U.S. debt, and currency moves", border: 'border-hue-indigo' },
  { id: 'military', label: 'Military & alliances', hint: 'NATO, G7, G20, BRICS and USMCA membership, and defense spending', border: 'border-hue-pink' },
  { id: 'compare', label: 'Compare', hint: 'Countries side by side on U.S. tariffs, export controls and sanctions', border: 'border-hue-cyan' },
  { id: 'guide', label: 'Guide', hint: 'What these sections show, where the data comes from, and their limits', border: 'border-ink' },
];

export const SOFT_TABS: TabDef<SoftTabId>[] = [
  { id: 'scoreboard', label: 'Scoreboard', hint: 'Is U.S. soft power rising or falling, and whose is?', border: 'border-hue-cyan' },
  { id: 'overview', label: 'Overview', hint: 'The short version', border: 'border-ink' },
  { id: 'attitudes', label: 'Attitudes', hint: 'What people in other countries say about the U.S., China and others', border: 'border-hue-cyan' },
  { id: 'culture', label: 'Culture & exchange', hint: 'Students, tourism, migration, science and knowledge ties', border: 'border-hue-cyan' },
  { id: 'values', label: 'Political values', hint: 'Governance, rights and democracy indicators', border: 'border-hue-cyan' },
  { id: 'foreign', label: 'Foreign policy & aid', hint: 'Aid, humanitarian giving, refugees, UN voting and instruments', border: 'border-hue-cyan' },
  { id: 'compare', label: 'Compare', hint: 'Countries side by side on every soft-power measure', border: 'border-hue-cyan' },
  { id: 'method', label: 'Method & gaps', hint: 'Sources, licences, what is not measured and why', border: 'border-ink' },
];

/** Old /abroad tab -> new Hard Power tab. */
export const OLD_ABROAD_TAB: Record<string, HardTabId> = { pressure: 'trade', reach: 'money', alliances: 'military', sanctions: 'sanctions', guide: 'guide' };
/** Old /allies tab -> new Hard Power tab. */
export const OLD_ALLIES_TAB: Record<string, HardTabId> = { hard: 'trade', soft: 'money', alliances: 'military', guide: 'guide' };

export function hardTabFrom(raw: string | null): HardTabId {
  return HARD_TABS.some((t) => t.id === raw) ? (raw as HardTabId) : 'overview';
}
export function softTabFrom(raw: string | null): SoftTabId {
  return SOFT_TABS.some((t) => t.id === raw) ? (raw as SoftTabId) : 'scoreboard';
}

const ABROAD = ['/abroad', '/influence', '/footprint'];
const ALLIES = ['/allies', '/power', '/standing', '/vs-world'];

/**
 * Where an old address now lives, or null when it is not an old address. The old U.S. abroad and Dollar & allies pages became the
 * Hard Power page (their tabs map onto its tabs), the old Compare page's two views became the Compare tab of each power page, and
 * the Wire's Data tab moved to Hard Power. Other query parameters (country, countries) are kept.
 */
export function legacyRedirect(pathname: string, search: URLSearchParams): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const q = new URLSearchParams(search);
  const finish = (path: string, tab: string | null) => {
    q.delete('tab');
    q.delete('view');
    if (tab && tab !== 'overview') q.set('tab', tab);
    const rest = q.toString();
    return `${path}${rest ? `?${rest}` : ''}`;
  };
  if (ABROAD.includes(clean)) return finish('/hard-power', OLD_ABROAD_TAB[search.get('tab') ?? ''] ?? null);
  if (ALLIES.includes(clean)) return finish('/hard-power', OLD_ALLIES_TAB[search.get('tab') ?? ''] ?? null);
  if (clean === '/compare') return finish(search.get('view') === 'power' ? '/soft-power' : '/hard-power', 'compare');
  if (clean === '/' && search.get('tab') === 'data') return finish('/hard-power', 'trade');
  return null;
}
