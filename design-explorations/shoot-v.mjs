import { chromium } from 'playwright';
import fs from 'fs';
const variants = process.argv.slice(2);
const jobs = [['wire','/','light',1280,900],['hard-power','/hard-power','light',1280,1500],['soft-power','/soft-power','light',1280,900],['hard-power','/hard-power','dark',1280,900],['wire','/','light',390,844]];
const b = await chromium.launch();
for (const v of variants) {
  const css = fs.readFileSync(`design-explorations/${v}.css`, 'utf8');
  for (const [pg, path, theme, w, h] of jobs) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await ctx.addInitScript(t => { try { localStorage.setItem('theme', t); } catch {} document.documentElement.dataset.theme = t; }, theme);
    const p = await ctx.newPage();
    await p.goto('https://aexterminal.com' + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(2500);
    await p.addStyleTag({ content: css }); await p.waitForTimeout(600);
    const f = `design-explorations/shots/${v}-${pg}-${theme}-${w}.png`;
    for (let i = 0; i < 2; i++) { try { await p.screenshot({ path: f, animations: 'disabled', timeout: 60000 }); break; } catch (e) { if (i) console.log('fail', f); } }
    await ctx.close();
  }
  console.log('done', v);
}
await b.close();
