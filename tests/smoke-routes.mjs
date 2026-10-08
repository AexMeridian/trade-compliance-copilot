// Loads every route at desktop and phone width against a running dev server and fails on
// any console/page error, failed request, horizontal overflow, or a page stuck on
// "Loading". Not part of CI (it needs the seeded local database and a browser):
//   npm run dev                          # terminal 1
//   npx playwright install chromium      # once
//   npm run test:smoke                   # terminal 2 (BASE_URL overrides http://127.0.0.1:8787)
import { chromium } from 'playwright';
const B = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const b = await chromium.launch();
const { samples } = await (await (await b.newPage()).request.get(`${B}/api/cases/samples`)).json();
const s = samples[0];
const routes = ['/', '/?tab=policy', '/?tab=markets', '/?tab=news', '/?tab=data', '/?tab=guide', '/calculator', '/abroad', '/abroad?tab=alliances', '/abroad?tab=sanctions', '/allies', '/allies?tab=soft', '/footprint', '/standing', '/vs-world', '/influence', '/power',
  '/country/cn', '/country/ng', '/compare?countries=CN,IN', '/about', '/privacy', '/accessibility', `/case/${s.id}`, `/case/${s.id}/report`, '/definitely-not-a-page'];
let bad = 0;
for (const [name, w] of [['desktop', 1280], ['mobile', 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  p.on('requestfailed', (r) => errs.push('reqfailed: ' + r.url()));
  p.on('response', (r) => r.status() >= 400 && !r.url().includes('definitely') && errs.push(`http ${r.status()}: ${r.url()}`));
  for (const r of routes) {
    errs.length = 0;
    await p.goto(B + r, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ h: document.querySelectorAll('h1,h2').length, over: document.documentElement.scrollWidth - window.innerWidth, loading: /^Loading…$/.test((document.querySelector('#main')?.textContent ?? '').trim()) }));
    const ok = info.h > 0 && info.over <= 0 && !info.loading && errs.length === 0;
    if (!ok) bad++;
    console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(8), r.padEnd(34), JSON.stringify(info), errs.slice(0, 2).join(' | '));
  }
  await p.close();
}
console.log(bad ? `${bad} FAILED` : 'ALL OK');
await b.close();
process.exit(bad ? 1 : 0);
