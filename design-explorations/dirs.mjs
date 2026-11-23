export const dirs = {
/* ---------------- 1 IVORY & FOREST ---------------- */
'dir-1-ivory-forest.css': {
 title: 'Direction 1: Ivory and Forest (editorial)',
 sel: '#cfe3d5', headerRule: '3px double var(--color-ink)', footRule: 'var(--color-ink)', radius: '4px',
 cardShadow: '0 1px 0 rgba(26,22,18,.04)',
 light: { cyan:'#2f7d5c', cyanInk:'#1b5a3e', paper:'#f6f1e6', raised:'#fffdf8', ink:'#1a1612', muted:'#453d33', faint:'#675d50', hair:'#e2d8c4', hairS:'#8c806c',
  accent:'#1b5a3e', hover:'#12422d', accentSoft:'#e1eee6', a2:'#b08430', a2ink:'#775210', a2soft:'#f3e9cf', mark:'#1b3a2c',
  soft:'#17696a', softTint:'#e0eeec', hard:'#b0481a', hardTint:'#f7e8db',
  heroBg:'#efe6d2', heroInk:'#1a1612', heroMuted:'#463d31', heroFaint:'#675c4c', hRgb:'26,22,18',
  btnBg:'#1b5a3e', btnText:'#fffdf8', btnHover:'#12422d', maskRgb:'239,230,210', glowRgb:'27,90,62',
  halo:'radial-gradient(circle at 80% 84%, rgba(176,132,48,.14) 0%, rgba(176,132,48,0) 52%)' },
 dark: { cyan:'#62bd8c', cyanInk:'#62bd8c', paper:'#14120e', raised:'#1d1a14', ink:'#f4eee0', muted:'#c9bfac', faint:'#9b907c', hair:'#2f2a21', hairS:'#5c5446',
  accent:'#62bd8c', hover:'#8ad3ab', accentSoft:'#15291f', a2:'#e0b45a', a2ink:'#e8c375', a2soft:'#2e2410', mark:'#d8d0bd',
  soft:'#4fc3b9', softTint:'#10282a', hard:'#f59a5b', hardTint:'#33200f',
  heroBg:'#0e0d0a', heroInk:'#fff', heroMuted:'#d9d2c2', heroFaint:'#b3ab99', hRgb:'255,255,255',
  btnBg:'#f4eee0', btnText:'#14120e', btnHover:'#fff', maskRgb:'14,13,10', glowRgb:'98,189,140' },
 css: `
div.no-print.border-b{background:var(--color-paper-raised);border-bottom:1px solid var(--color-ink)}
.display,h1,h2,h3{letter-spacing:-0.015em}
footer{border-top:1px solid var(--color-ink);background:var(--color-paper)}
[role=tablist] [role=tab]{border-radius:2px}
`},

/* ---------------- 2 SIGNAL VERMILION ---------------- */
'dir-2-signal-vermilion.css': {
 title: 'Direction 2: Crisp white, one vermilion signal',
 sel: '#ffd2c6', headerRule: '4px solid var(--color-accent)', footRule: 'var(--color-accent)', radius: '2px',
 cardShadow: 'none',
 light: { cyan:'#0a0a0a', cyanInk:'#0a0a0a', paper:'#ffffff', raised:'#ffffff', ink:'#0a0a0a', muted:'#333333', faint:'#575757', hair:'#e6e6e6', hairS:'#6b6b6b',
  accent:'#d9300c', hover:'#b3250a', accentSoft:'#fff0eb', a2:'#0a0a0a', a2ink:'#0a0a0a', a2soft:'#f2f2f2', mark:'#0a0a0a',
  soft:'#007a72', softTint:'#e3f4f2', hard:'#d9300c', hardTint:'#fff0eb',
  heroBg:'#ffffff', heroInk:'#0a0a0a', heroMuted:'#333333', heroFaint:'#575757', hRgb:'10,10,10',
  btnBg:'#d9300c', btnText:'#ffffff', btnHover:'#b3250a', maskRgb:'255,255,255', glowRgb:'217,48,12' },
 dark: { cyan:'#fafafa', cyanInk:'#fafafa', paper:'#0b0b0b', raised:'#151515', ink:'#fafafa', muted:'#cfcfcf', faint:'#9a9a9a', hair:'#2a2a2a', hairS:'#585858',
  accent:'#ff5a36', hover:'#ff7a5c', accentSoft:'#2c120b', a2:'#fafafa', a2ink:'#fafafa', a2soft:'#1d1d1d', mark:'#fafafa',
  soft:'#3ed3c6', softTint:'#0d2826', hard:'#ff5a36', hardTint:'#2c120b',
  heroBg:'#0b0b0b', heroInk:'#fff', heroMuted:'#d4d4d4', heroFaint:'#a3a3a3', hRgb:'255,255,255',
  btnBg:'#ff5a36', btnText:'#0b0b0b', btnHover:'#ff7a5c', maskRgb:'11,11,11', glowRgb:'255,90,54' },
 css: `
.card{border:1px solid var(--color-ink)}
:root[data-theme='dark'] .card{border-color:var(--color-hairline-strong)}
.card:hover{border-color:var(--color-accent)}
.card .display{color:var(--color-accent)}
div.no-print.border-b{background:#0a0a0a;border-color:#0a0a0a;--color-ink:#fff;--color-ink-muted:#e0e0e0;--color-ink-faint:#c8c8c8;--color-clear:#4ade80;--color-stop:#ff8478;--color-hairline:#333}
footer{border-top:4px solid var(--color-accent);background:var(--color-paper)}
[role=tablist] [role=tab]{border-radius:2px;border-color:var(--color-ink);color:var(--color-ink)}
[role=tablist] [role=tab][aria-selected=true]{background:var(--color-accent);border-color:var(--color-accent);color:#fff}
:root[data-theme='dark'] [role=tablist] [role=tab]{border-color:var(--color-hairline-strong);color:var(--color-ink)}
:root[data-theme='dark'] [role=tablist] [role=tab][aria-selected=true]{color:#0b0b0b}
main h1:not(.text-center)::after{content:'';display:block;width:84px;height:7px;background:var(--color-accent);margin-top:16px}
.btn-primary{border-radius:2px}
`},

/* ---------------- 3 GRAPHITE & EMERALD ---------------- */
'dir-3-graphite-emerald.css': {
 title: 'Direction 3: Graphite and Emerald (terminal band)',
 sel: '#bdeed7', headerRule: '2px solid #10b981', footRule: '#10b981', radius: '3px',
 cardShadow: 'none',
 light: { cyan:'#10b981', cyanInk:'#006f47', paper:'#f5f7f6', raised:'#ffffff', ink:'#0d1210', muted:'#36423c', faint:'#56635c', hair:'#dbe3de', hairS:'#7c8b83',
  accent:'#006f47', hover:'#00553a', accentSoft:'#e0f4ea', a2:'#f2b01e', a2ink:'#855700', a2soft:'#fdf2d6', mark:'#0d1210',
  soft:'#0b7285', softTint:'#e1f2f5', hard:'#c2410c', hardTint:'#fdece3',
  heroBg:'#0e1512', heroInk:'#f2f7f4', heroMuted:'#c4d0ca', heroFaint:'#9aaba2', hRgb:'255,255,255',
  btnBg:'#10b981', btnText:'#04130d', btnHover:'#34d399', maskRgb:'14,21,18', glowRgb:'16,185,129' },
 dark: { cyan:'#34d399', cyanInk:'#34d399', paper:'#0b100e', raised:'#141b18', ink:'#eef4f1', muted:'#b9c7c0', faint:'#8a9a92', hair:'#222d28', hairS:'#445249',
  accent:'#34d399', hover:'#6ee7b7', accentSoft:'#0c2a1f', a2:'#fbbf24', a2ink:'#fbbf24', a2soft:'#33250a', mark:'#d9e4df',
  soft:'#38bdf8', softTint:'#0b2530', hard:'#fb923c', hardTint:'#33200f',
  heroBg:'#0b100e', heroInk:'#fff', heroMuted:'#c4d0ca', heroFaint:'#9aaba2', hRgb:'255,255,255',
  btnBg:'#10b981', btnText:'#04130d', btnHover:'#34d399', maskRgb:'11,16,14', glowRgb:'16,185,129' },
 css: `
header.sticky{--color-ink:#eef4f1;--color-ink-muted:#c4d0ca;--color-mark:#eef4f1;--color-paper-raised:#0d1210;--color-hairline:#26322c;background:rgba(13,18,16,.96)}
header.sticky{--color-paper:#0d1210}
header.sticky a[aria-current]{background:#10b981;color:#04130d}
div.no-print.border-b{background:#141b18;border-color:#26322c;--color-ink:#eef4f1;--color-ink-muted:#c4d0ca;--color-ink-faint:#a9b8b0;--color-clear:#4ade80;--color-stop:#ff8478;--color-hairline:#26322c}
.card{border-left:3px solid var(--glow,var(--color-accent))}
.card-accent::before{display:none}
footer{background:#0d1210;color:#b9c7c0;--color-ink:#eef4f1;--color-ink-muted:#b9c7c0;--color-mark:#eef4f1;--color-hairline:#26322c;border-top:2px solid #10b981}
footer{--color-clear:#4ade80;--color-stop:#ff8478}
.display{font-variant-numeric:tabular-nums}
[role=tablist] [role=tab]{border-radius:3px}
`},

/* ---------------- 4 NAVY INK & BRASS ---------------- */
'dir-4-navy-brass.css': {
 title: 'Direction 4: Navy Ink hero bands with brass',
 sel: '#e8d9ac', headerRule: '3px solid #c9a24a', footRule: '#c9a24a', radius: '6px',
 cardShadow: '0 1px 2px rgba(15,17,22,.06)',
 light: { cyan:'#c9a24a', cyanInk:'#7a5a12', paper:'#ffffff', raised:'#ffffff', ink:'#101216', muted:'#3a3f4a', faint:'#5a606c', hair:'#e5e6ea', hairS:'#7d8290',
  accent:'#13264a', hover:'#0b1a36', accentSoft:'#eef0f5', a2:'#c9a24a', a2ink:'#7a5a12', a2soft:'#f8f0da', mark:'#13264a',
  soft:'#0e7a76', softTint:'#e2f2f1', hard:'#b8480f', hardTint:'#fbece2',
  heroBg:'#0e1a33', heroInk:'#ffffff', heroMuted:'#cfd6e4', heroFaint:'#a3adc4', hRgb:'255,255,255',
  btnBg:'#c9a24a', btnText:'#10131c', btnHover:'#dbb760', maskRgb:'14,26,51', glowRgb:'201,162,74',
  halo:'radial-gradient(circle at 80% 84%, rgba(201,162,74,.2) 0%, rgba(201,162,74,0) 52%)' },
 dark: { cyan:'#e0bb62', cyanInk:'#e0bb62', paper:'#0c0d10', raised:'#16181d', ink:'#f3f4f6', muted:'#c0c4ce', faint:'#8f95a3', hair:'#25272e', hairS:'#4b4f5b',
  accent:'#e0bb62', hover:'#efd085', accentSoft:'#2a2312', a2:'#e0bb62', a2ink:'#e8c875', a2soft:'#2a2312', mark:'#e6e8ee',
  soft:'#3dcfc9', softTint:'#0d2827', hard:'#fb923c', hardTint:'#33200f',
  heroBg:'#0a1226', heroInk:'#fff', heroMuted:'#cfd6e4', heroFaint:'#a3adc4', hRgb:'255,255,255',
  btnBg:'#e0bb62', btnText:'#10131c', btnHover:'#efd085', maskRgb:'10,18,38', glowRgb:'224,187,98' },
 css: `
div.no-print.border-b{background:#0e1a33;border-color:#0e1a33;--color-ink:#fff;--color-ink-muted:#dbe1ee;--color-ink-faint:#b9c2d6;--color-clear:#4ade80;--color-stop:#ff8478;--color-hairline:#2b3a5e}
:root[data-theme='dark'] .btn-primary{color:#10131c}
:root:not([data-theme='dark']) .btn-primary{color:#fff}
.card-accent::before{background:#c9a24a}
footer{background:#0e1a33;color:#cfd6e4;--color-ink:#fff;--color-ink-muted:#cfd6e4;--color-mark:#e6c777;--color-hairline:#2b3a5e;border-top:3px solid #c9a24a}
[role=tablist] [role=tab]{border-radius:2px}
`},

/* ---------------- 5 AUBERGINE & CITRON ---------------- */
'dir-5-aubergine-citron.css': {
 title: 'Direction 5: Aubergine and Citron (highlighter)',
 sel: '#e4f08a', headerRule: '1px solid var(--color-hairline)', footRule: '#d7ec45', radius: '14px',
 cardShadow: '0 1px 2px rgba(30,12,48,.06), 0 10px 24px -18px rgba(70,20,110,.35)',
 light: { cyan:'#7a3fb0', cyanInk:'#561d7a', paper:'#ffffff', raised:'#ffffff', ink:'#16101c', muted:'#453c50', faint:'#655b71', hair:'#e9e4ee', hairS:'#8a7f97',
  accent:'#561d7a', hover:'#3f1259', accentSoft:'#f3ebf8', a2:'#d7ec45', a2ink:'#586600', a2soft:'#f5fbcf', mark:'#561d7a',
  soft:'#0b7a6e', softTint:'#e0f3f0', hard:'#d1491a', hardTint:'#fdece4',
  heroBg:'#ffffff', heroInk:'#16101c', heroMuted:'#453c50', heroFaint:'#655b71', hRgb:'22,16,28',
  btnBg:'#561d7a', btnText:'#ffffff', btnHover:'#3f1259', maskRgb:'255,255,255', glowRgb:'86,29,122',
  halo:'radial-gradient(circle at 80% 84%, rgba(215,236,69,.3) 0%, rgba(215,236,69,0) 52%)' },
 dark: { cyan:'#c79bf0', cyanInk:'#c79bf0', paper:'#0f0a14', raised:'#1a1322', ink:'#f6f2fa', muted:'#cfc5da', faint:'#9d92ab', hair:'#2b2236', hairS:'#53476a',
  accent:'#c79bf0', hover:'#ddbdf8', accentSoft:'#2a173d', a2:'#d7ec45', a2ink:'#d7ec45', a2soft:'#26290a', mark:'#d9c4ee',
  soft:'#3dd1c0', softTint:'#0c2b28', hard:'#ff8a5c', hardTint:'#35190f',
  heroBg:'#0a0610', heroInk:'#fff', heroMuted:'#d6cce2', heroFaint:'#a99dba', hRgb:'255,255,255',
  btnBg:'#d7ec45', btnText:'#16101c', btnHover:'#e6f77a', maskRgb:'10,6,16', glowRgb:'199,155,240' },
 css: `
header.sticky::after{content:'';display:block;height:4px;background:#d7ec45;position:absolute;left:0;right:0;bottom:-5px}
div.no-print.border-b{background:#561d7a;border-color:#561d7a;padding-top:4px;--color-ink:#fff;--color-ink-muted:#eadcf6;--color-ink-faint:#d6c2ea;--color-clear:#4ade80;--color-stop:#ff8478;--color-hairline:#7a3fa0}
:root[data-theme='dark'] div.no-print.border-b{background:#1a1322}
main h1:not(.text-center){background:linear-gradient(transparent 60%, #d7ec45 60%, #d7ec45 92%, transparent 92%);display:inline;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .12em;margin-left:-.12em}
:root[data-theme='dark'] main h1:not(.text-center){background:none}
.card-accent::before{background:linear-gradient(90deg,var(--glow,var(--color-accent)),#d7ec45)}
footer{border-top:4px solid #d7ec45}
:root[data-theme='dark'] .btn-primary{color:#16101c}
`},
};
