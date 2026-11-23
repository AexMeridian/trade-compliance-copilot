# Design explorations

Five alternatives to the rejected blue tint. Each is a CSS override file (`dir-N-*.css`) injected onto the live site with Playwright, so the screenshots in `shots/` show real data. No source file was changed.
Screenshot names: `dir-N-name-<page>-<theme>-<width>.png` (Wire home, Hard Power, Soft Power in light; Hard Power in dark; Wire at 390px). `current-*` is the live site now.
Re-run one: `node design-explorations/shoot.mjs <name> design-explorations/<file>.css`.

| # | Direction | What you see (Hard Power, light) |
|---|---|---|
| 1 | Ivory and forest (`dir-1-ivory-forest.css`) | Warm cream page, deep ink text, forest-green buttons, tabs and bars; rust figures. Editorial, FT-like. |
| 2 | Signal vermilion (`dir-2-signal-vermilion.css`) | True white page, black ink, one hot red-orange used on buttons, active tab fill, headline rule and figures; black ticker strip. Bold and crisp. |
| 3 | Graphite and emerald (`dir-3-graphite-emerald.css`) | Near-black hero and ticker with an emerald signal color against light content cards. Terminal-like. |
| 4 | Navy and brass (`dir-4-navy-brass.css`) | White page, deep navy hero band, brass-gold buttons and bars, gold header rule. Institutional. |
| 5 | Aubergine and citron (`dir-5-aubergine-citron.css`) | White page, aubergine purple accents and ticker, a citron highlighter mark behind the headline. Most distinctive; also the riskiest. |

Not yet reviewed in detail: the dark-mode and 390px shots for each direction. Open them before choosing.
