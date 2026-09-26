// Category colors. The page is black and white; these hues sort the content so a
// glance tells you what kind of thing you are looking at (see the note at the top
// of index.css). Red and green are not used here: they stay reserved for up/down
// moves (PulseDelta) so a topic never reads as good or bad. Full class names are
// spelled out so Tailwind can see and generate them.

export interface Hue {
  text: string; // dark enough for text on white
  bg: string; // bright, for fills and dots
  border: string;
  css: string; // for SVG strokes/fills
}

const hue = (text: string, bg: string, border: string, css: string): Hue => ({ text, bg, border, css });

const ORANGE = hue('text-hue-orange-ink', 'bg-hue-orange', 'border-hue-orange', 'var(--color-hue-orange)');
const VIOLET = hue('text-hue-violet-ink', 'bg-hue-violet', 'border-hue-violet', 'var(--color-hue-violet)');
const CYAN = hue('text-hue-cyan-ink', 'bg-hue-cyan', 'border-hue-cyan', 'var(--color-hue-cyan)');
const PINK = hue('text-hue-pink-ink', 'bg-hue-pink', 'border-hue-pink', 'var(--color-hue-pink)');
const INDIGO = hue('text-hue-indigo-ink', 'bg-hue-indigo', 'border-hue-indigo', 'var(--color-hue-indigo)');
const GRAY = hue('text-hue-gray-ink', 'bg-hue-gray', 'border-hue-gray', 'var(--color-hue-gray)');

export const TAG_HUE: Record<string, Hue> = {
  Tariff: ORANGE,
  Sanctions: VIOLET,
  'Export Control': CYAN,
  'Trade Agreement': PINK,
  Other: GRAY,
};

export const NEWS_HUE: Record<string, Hue> = {
  'Trade & Supply Chain': CYAN,
  'Markets & Currency': INDIGO,
  'Elections & Politics': PINK,
  Official: ORANGE,
};

export const GROUP_HUE: Record<string, Hue> = {
  'U.S. stocks': INDIGO,
  'World stocks': CYAN,
  'Trade bellwethers': VIOLET,
  Commodities: ORANGE,
  'Rates & dollar': GRAY,
};

// Series colors for multi-line charts, in legend order.
export const SERIES_HUES: Hue[] = [INDIGO, ORANGE, CYAN, PINK];

export const SECTION_HUE = { policy: ORANGE, markets: INDIGO, news: PINK, comment: VIOLET } as const;
