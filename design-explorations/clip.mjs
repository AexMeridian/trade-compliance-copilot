import { chromium } from 'playwright';
const [,, path, theme, out, y, h] = process.argv;
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1280,height:900}});
await ctx.addInitScript((t)=>{localStorage.setItem('theme',t);document.documentElement.dataset.theme=t},theme);
const pg = await ctx.newPage(); await pg.goto('http://localhost:4175'+path,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(4000);
await pg.screenshot({path:out,fullPage:true,clip:{x:0,y:+y,width:1280,height:+h},animations:'disabled',timeout:60000}); await b.close();
