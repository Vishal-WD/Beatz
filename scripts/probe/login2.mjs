import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
const authCalls=[];
p.on('response', async r=>{ if(/\/auth\/v1\/token|\/auth\/v1\/signup/.test(r.url())){
  let body=''; try{ body=JSON.stringify(await r.json()).slice(0,150);}catch{}
  authCalls.push(`${r.status()} ${r.url().split('/auth/v1/')[1].split('?')[0]} ${body}`); }});
await p.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p.waitForSelector('input',{timeout:25000});
const inp=p.locator('input');
await inp.nth(0).fill('maya@auxwars.demo');
await inp.nth(1).fill(process.env.DEMO_PASS||'auxwars2026');
await p.locator('form button').last().click();
await p.waitForTimeout(6000);
console.log('=== AUTH NETWORK CALLS ===');
authCalls.forEach(c=>console.log(' ', c));
const err = await p.evaluate(()=>{
  const t=[...document.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.textContent.trim());
  return t.filter(x=>/invalid|incorrect|error|credential|confirm|not found/i.test(x));
});
console.log('\nmessage shown to user:', err.length?err:'(none)');
await b.close();
