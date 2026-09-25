// One place for Pulse's category colors. Full class names are spelled out
// (not built from strings) so Tailwind can see and generate them. Hues come
// from the --color-cat-* tokens in index.css and are never red or green,
// which stay reserved for up/down movement (PulseDelta).

export interface Hue {
  text: string;
  bg: string;
  border: string;
  css: string; // for SVG strokes/fills
}

const AMBER: Hue = { text: 'text-cat-amber', bg: 'bg-cat-amber', border: 'border-cat-amber', css: 'var(--color-cat-amber)' };
const BLUE: Hue = { text: 'text-cat-blue', bg: 'bg-cat-blue', border: 'border-cat-blue', css: 'var(--color-cat-blue)' };
const VIOLET: Hue = { text: 'text-cat-violet', bg: 'bg-cat-violet', border: 'border-cat-violet', css: 'var(--color-cat-violet)' };
const TEAL: Hue = { text: 'text-cat-teal', bg: 'bg-cat-teal', border: 'border-cat-teal', css: 'var(--color-cat-teal)' };
const GRAY: Hue = { text: 'text-cat-gray', bg: 'bg-cat-gray', border: 'border-cat-gray', css: 'var(--color-cat-gray)' };

export const TAG_HUE: Record<string, Hue> = {
  Tariff: AMBER,
  Sanctions: VIOLET,
  'Export Control': BLUE,
  'Trade Agreement': TEAL,
  Other: GRAY,
};

export const NEWS_HUE: Record<string, Hue> = {
  'Trade & Supply Chain': TEAL,
  'Markets & Currency': BLUE,
  'Elections & Politics': VIOLET,
  Official: AMBER,
};

export const GROUP_HUE: Record<string, Hue> = {
  'U.S. stocks': BLUE,
  'World stocks': TEAL,
  'Trade bellwethers': VIOLET,
  Commodities: AMBER,
  'Rates & dollar': GRAY,
};

// Series colors for multi-line charts, in legend order.
export const SERIES_HUES: Hue[] = [BLUE, AMBER, VIOLET, TEAL];

// Whole-page sections (tab underline, hero card accent).
export const SECTION_HUE = { policy: AMBER, markets: BLUE, news: TEAL, comment: VIOLET } as const;
