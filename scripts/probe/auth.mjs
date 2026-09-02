import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const email = `probe.${Date.now()}@gmail.com`;
const pass  = 'ProbePass!2026';

console.log('=== REGISTRATION ===');
console.log('email:', email);
await p.goto('http://localhost:3100/signin',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(1500);

// Switch to the sign-up mode if the screen offers it
const txt = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('screen:', txt.slice(0,150));

const toggle = p.locator('button', { hasText:/CREATE|SIGN UP|REGISTER|NEW/i });
if (await toggle.count()) { await toggle.first().click(); await p.waitForTimeout(600); }

const inputs = p.locator('input');
const n = await inputs.count();
console.log('input fields:', n);
for (let i=0;i<n;i++){
  const t = await inputs.nth(i).getAttribute('type');
  const ac = await inputs.nth(i).getAttribute('autocomplete');
  if (t==='email') await inputs.nth(i).fill(email);
  else if (t==='password') await inputs.nth(i).fill(pass);
  else await inputs.nth(i).fill('Probe Player');
  console.log(`  field ${i}: type=${t} autocomplete=${ac}`);
}
await p.locator('button[type=submit], form button').last().click();
await p.waitForTimeout(6000);

const after = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('after submit:', after.slice(0,200));
console.log('js errors:', errs.length?errs.slice(0,2):'none');

console.log('\n=== SESSION PERSISTS ACROSS RELOAD? ===');
await p.reload({waitUntil:'networkidle'});
await p.waitForTimeout(3000);
const reloaded = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('after reload:', reloaded.slice(0,180));
const ls = await p.evaluate(()=>Object.keys(localStorage).filter(k=>/auth|supabase|sb-/.test(k)));
console.log('session keys in localStorage:', ls);
await b.close();
