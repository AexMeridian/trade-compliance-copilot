# Redesign of three features (uncommitted working-tree edits)

Screenshots: before-*.png and after-*.png in this folder. Helper scripts: ../serve.mjs (static + /api proxy on :4175), ../shoot.mjs, ../clip.mjs, ../full.mjs.

## 1. Globe box (Soft Power hero and UN-alignment globe)
Wrong: the globe sat in a hard black rectangle on the navy hero, with a black sea, a tiny legend and an empty left column.
Changed: the box is gone (.globe-open, transparent); sphere sits straight on the navy, sea is now a lit navy gradient (#16284f > #0c1936 > #070e22, open maps only); legend is a floating glass pill (.globe-legend); hint text quieter; figure column is vertically centred with a gold small-caps kicker (#d8c08a) above the big figure; globe pulled up and slightly bleeds right. UN-alignment globe: card/box replaced by a rounded navy gradient stage with the year slider moved inside it as a floating control.
Files: components/MeasureAtlas.tsx, MeasureHero.tsx, SoftPowerHero.tsx, PulseGlobe.tsx (plain mode only), UnAlignmentGlobe.tsx, theme-midnight.css.
Trade-off: the kicker also shows on the Hard Power hero; the Wire globe is untouched.

## 2. Market strip
Wrong: heavy navy band, plain text, no hierarchy.
Changed: slim light glass bar (rgba 247,248,251 light; 22,24,29 dark), hairline separators, small-caps tracked labels, 13px tabular values, smaller triangles, gold-ink date (#6f5a20 light / #e8c875 dark), edge fade, slower 70s marquee (existing pause on hover/focus and reduced-motion handling kept). Green/red unchanged.
Files: components/MarketStrip.tsx, theme-midnight.css (old `div.no-print.border-b` navy rule removed).

## 3. Hard Power colour
Wrong: burnt orange read as off-theme.
Changed: --color-hard #2c5a7e (steel blue; light) with tint #e8eff6; dark #7fb0d6 with tint #12212f. Contrast about 6.5:1 and 7:1 on tints. Distinct from Soft teal (#0e7a76) and navy accent. Trade tools tab underline now uses border-hard.
Files: theme-midnight.css, lib/powerTabs.ts.
Trade-off: semantic "orange = tariffs / China" category colours (chips, ranked-bar highlight, China lines in charts) were left alone because they carry meaning across the site; index.css base --color-hard is overridden by the theme file.

## Revert
git checkout -- frontend/src/components/MeasureAtlas.tsx frontend/src/components/MeasureHero.tsx frontend/src/components/SoftPowerHero.tsx frontend/src/components/PulseGlobe.tsx frontend/src/components/UnAlignmentGlobe.tsx frontend/src/components/MarketStrip.tsx frontend/src/theme-midnight.css frontend/src/lib/powerTabs.ts
