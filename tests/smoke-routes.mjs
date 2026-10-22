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
const routes = ['/', '/?tab=policy', '/?tab=markets', '/?tab=news', '/?tab=guide', '/calculator', '/methodology', '/terms',
  '/hard-power', '/hard-power?tab=trade', '/hard-power?tab=sanctions', '/hard-power?tab=money', '/hard-power?tab=military', '/hard-power?tab=compare', '/hard-power?tab=guide',
  '/soft-power', '/soft-power?tab=overview', '/soft-power?tab=attitudes', '/soft-power?tab=culture', '/soft-power?tab=values', '/soft-power?tab=foreign', '/soft-power?tab=compare', '/soft-power?tab=method', '/soft-power?tab=compare&countries=US,CN,IN',
  // Old addresses: each must land on its new page without errors.
  '/abroad', '/abroad?tab=alliances', '/abroad?tab=sanctions', '/allies', '/allies?tab=soft', '/footprint', '/standing', '/vs-world', '/influence', '/power', '/compare?countries=CN,IN', '/compare?view=power&countries=US,CN,IN', '/?tab=data',
  '/country/cn', '/country/cn?tab=influence', '/country/cn?tab=soft', '/country/ng', '/about', '/privacy', '/accessibility', '/cookies', '/disclaimer', '/copyright', '/security', `/case/${s.id}`, `/case/${s.id}/report`, '/definitely-not-a-page'];
let bad = 0;
for (const [name, w] of [['desktop', 1280], ['mobile', 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e));
  // An unknown address now answers with a real 404, which the browser logs; that is the expected result for that route only.
  p.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && errs.push('console: ' + m.text()));
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
