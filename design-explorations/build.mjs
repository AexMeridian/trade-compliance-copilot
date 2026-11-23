import fs from 'fs';
const T = (t) => `
  --color-paper:${t.paper}; --color-paper-raised:${t.raised};
  --color-ink:${t.ink}; --color-ink-muted:${t.muted}; --color-ink-faint:${t.faint};
  --color-hairline:${t.hair}; --color-hairline-strong:${t.hairS};
  --color-accent:${t.accent}; --color-accent-hover:${t.hover}; --color-accent-soft:${t.accentSoft};
  --color-accent-2:${t.a2}; --color-accent-2-ink:${t.a2ink}; --color-accent-2-soft:${t.a2soft};
  --color-mark:${t.mark};
  --color-hue-indigo:${t.accent}; --color-hue-indigo-ink:${t.accentInk||t.accent};
  --color-hue-blue-ink:${t.accentInk||t.accent};
  --color-hue-cyan:${t.cyan}; --color-hue-cyan-ink:${t.cyanInk}; --color-soft:${t.soft}; --color-soft-tint:${t.softTint};
  --color-hard:${t.hard}; --color-hard-tint:${t.hardTint};
  --color-hero-bg:${t.heroBg}; --color-hero-ink:${t.heroInk}; --color-hero-ink-muted:${t.heroMuted}; --color-hero-ink-faint:${t.heroFaint};
  --color-hero-border:rgba(${t.hRgb},.28); --color-hero-border-strong:rgba(${t.hRgb},.6); --color-hero-divider:rgba(${t.hRgb},.12); --color-hero-card-bg:rgba(${t.hRgb},.05);
  --color-hero-btn-bg:${t.btnBg}; --color-hero-btn-text:${t.btnText}; --color-hero-btn-hover:${t.btnHover};
  --hero-mask-rgb:${t.maskRgb}; --hero-glow-rgb:${t.glowRgb}; --hero-halo-2:${t.halo||'none'}; --globe-shadow-alpha:${t.shadowA??0.12}; --hero-glow-alpha:.12;
  ${t.extraVars||''}`;
const base = (d) => `/* ${d.title} */
:root:not([data-theme='dark']){${T(d.light)}}
:root[data-theme='dark']{${T(d.dark)}}
:root:not([data-theme='dark']) .stage{--color-hero-bg:#05070d}
::selection{background:${d.sel}}
header.sticky{border-image:none;border-bottom:${d.headerRule}}
footer{background-image:none}
.edge-glow{background-image:none;background:${d.footRule}}
.page-glow::before{background-image:none}
.btn-primary{background-image:none;box-shadow:none}
.card-accent::before{background:var(--glow,var(--color-accent))}
.card{box-shadow:${d.cardShadow};border-color:var(--color-hairline);border-radius:${d.radius}}
.card:hover{border-color:var(--color-hairline-strong)}
${d.css}`;
import { dirs } from './dirs.mjs';
for (const [file, d] of Object.entries(dirs)) { fs.writeFileSync(new URL(file, import.meta.url), base(d)); console.log('wrote', file); }
