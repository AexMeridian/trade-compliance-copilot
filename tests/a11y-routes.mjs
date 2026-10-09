// Accessibility check: runs axe-core on every public route in both themes at desktop and phone width and
// fails on any serious or critical finding. Needs the app running locally (same as test:smoke).
//   npx wrangler dev          # terminal 1
//   npm run test:a11y         # terminal 2   (BASE_URL overrides http://127.0.0.1:8787)
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSource = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const routes = ['/', '/?tab=policy', '/?tab=guide', '/calculator', '/methodology', '/terms', '/privacy', '/accessibility', '/about', '/abroad', '/abroad?tab=alliances', '/allies', '/country/cn', '/compare?countries=CN,IN'];
const browser = await chromium.launch();
let failed = 0;
for (const theme of ['dark', 'light']) {
  for (const [label, width] of [['desktop', 1280], ['mobile', 390]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
    for (const route of routes) {
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.evaluate(axeSource);
      const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
      const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (bad.length) {
        failed += bad.length;
        for (const v of bad) console.log(`FAIL ${theme} ${label} ${route}: ${v.id} (${v.impact}) x${v.nodes.length} -- ${v.help}\n     e.g. ${v.nodes[0].html.slice(0, 140)}`);
      } else console.log(`ok   ${theme} ${label} ${route}`);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
if (failed) { console.log(`\n${failed} serious/critical accessibility violation(s)`); process.exit(1); }
console.log('\nALL OK');
