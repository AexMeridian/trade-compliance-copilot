import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1280,height:900}});
await p.goto('https://aexterminal.com/hard-power',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>{
 let e=document.querySelector('.ticker'); const o=[]; for(let i=0;i<4&&e;i++){e=e.parentElement;o.push(e.tagName+' '+e.className+' | '+getComputedStyle(e).backgroundColor);}
 const t=document.querySelector('[role=tablist]'); o.push('TABLIST PARENT '+t.parentElement.className+' / '+t.parentElement.parentElement.className);
 const tabs=[...document.querySelectorAll('[role=tab]')].map(x=>x.className); o.push(tabs[0]); o.push(tabs[1]);
 const c=document.querySelector('.card'); o.push('CARD '+c.className+' '+c.outerHTML.slice(0,500));
 const h=document.querySelector('main section, main > div'); o.push('MAIN CHILD '+h.className);
 return o.join('\n');}));
await b.close();
