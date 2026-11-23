import { chromium } from 'playwright';
const tag = process.argv[2];
const shots = [
 ['soft-light-900','/soft-power','light',1280,900],['soft-light-1400','/soft-power','light',1280,1400],
 ['foreign-light','/soft-power?tab=foreign','light',1280,1400],
 ['hard-light-1100','/hard-power','light',1280,1100],['hard-dark-900','/hard-power','dark',1280,900],
 ['home-light','/','light',1280,700],['soft-phone','/soft-power','light',390,1400],['hard-phone','/hard-power','light',390,1400],
 ['soft-dark','/soft-power','dark',1280,1100],['home-dark','/','dark',1280,500],
];
const only = process.argv[3];
const b = await chromium.launch();
for (const [n,p,t,w,h] of shots) {
  if (only && !n.includes(only)) continue;
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  await ctx.addInitScript((t)=>{ try{localStorage.setItem('theme',t)}catch{}; document.documentElement.dataset.theme=t; }, t);
  const pg = await ctx.newPage();
  await pg.goto('http://localhost:4175'+p,{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3500);
  const ov = await pg.evaluate(()=>document.documentElement.scrollWidth - innerWidth);
  if (ov>0) console.log('OVERFLOW',n,ov);
  if(n==='foreign-light'){await pg.evaluate(()=>{const e=document.querySelector('.un-stage')||document.body;e.scrollIntoView({block:'start'});window.scrollBy(0,-120)});await pg.waitForTimeout(800)}
  await pg.screenshot({path:`design-explorations/redesign/${tag}-${n}.png`,animations:'disabled',timeout:60000});
  await ctx.close();
}
await b.close();
