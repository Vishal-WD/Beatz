import { chromium } from 'playwright';
const U='https://beatz-kappa.vercel.app';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:844}});
const errs=[]; const net=[];
p.on('pageerror',e=>errs.push(e.message));
p.on('request',r=>{ const u=r.url();
  if(/supabase\.co|onrender\.com/.test(u)) net.push(u.split('?')[0].slice(0,60)); });

console.log('=== DECK ===');
await p.goto(U+'/deck',{waitUntil:'domcontentloaded',timeout:40000});
await p.waitForTimeout(6000);
const t=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log(t.slice(0,220));
console.log('\ncalls to supabase/render:', net.length ? [...new Set(net)] : 'NONE');
console.log('js errors:', errs.length?errs.slice(0,2):'none');

console.log('\n=== SIGN IN ===');
await p.goto(U+'/signin',{waitUntil:'domcontentloaded',timeout:40000});
await p.waitForTimeout(4000);
console.log('inputs:', await p.locator('input').count());
console.log((await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '))).slice(0,140));
await b.close();
