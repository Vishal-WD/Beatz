import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const email=`probe.${Date.now()}@gmail.com`, pass='ProbePass!2026';
await p.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1200);
await p.locator('button', {hasText:/CREATE AN ACCOUNT/i}).first().click();
await p.waitForTimeout(500);
const inp=p.locator('input');
await inp.nth(0).fill('Probe Player'); await inp.nth(1).fill(email); await inp.nth(2).fill(pass);
await p.locator('form button').last().click();
await p.waitForTimeout(6000);

const store = await p.evaluate(()=>({
  ls: Object.keys(localStorage),
  sessionish: Object.keys(localStorage).filter(k=>/sb-|supabase|auth/i.test(k)),
  hasToken: Object.entries(localStorage).some(([,v])=>/access_token/.test(v||'')),
}));
console.log('=== WHERE DOES THE SESSION LIVE? ===');
console.log('localStorage keys :', store.ls);
console.log('auth-ish keys     :', store.sessionish);
console.log('holds access_token:', store.hasToken);

console.log('\n=== SESSION SURVIVES A BRAND NEW TAB? ===');
const p2 = await ctx.newPage();          // same context = same storage
await p2.goto('http://localhost:3100/profile',{waitUntil:'domcontentloaded'});
await p2.waitForTimeout(3500);
const t = await p2.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,200));
console.log(t);

console.log('\n=== SIGN OUT ===');
await p2.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p2.waitForTimeout(2500);
const so=p2.locator('button',{hasText:/SIGN OUT/i});
console.log('sign-out button present:', await so.count()>0);
if (await so.count()){ await so.first().click(); await p2.waitForTimeout(3000);
  console.log('after sign-out:', await p2.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,120)));
  console.log('keys remaining:', await p2.evaluate(()=>Object.keys(localStorage).filter(k=>/sb-|auth/i.test(k))));
}
console.log('\nEMAIL USED:', email);
await b.close();
