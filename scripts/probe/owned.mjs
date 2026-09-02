import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const email=`own.${Date.now()}@gmail.com`;

console.log('=== GUEST (no account) ===');
await p.goto('http://localhost:3100/deck',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(5000);
const guest = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('identity :', /YOU ARE \| ([^|]+)/.exec(guest)?.[1]?.trim());
console.log('holder   :', /(THRONE OPEN[^|]*|[A-Z. ]+HOLDS)/.exec(guest)?.[1]?.trim());
console.log('collection:', /(YOUR COLLECTION · \d+|PREVIEW · SIGN IN TO OWN)/.exec(guest)?.[1]);

console.log('\n=== REGISTER, THEN CHECK THE HAND ===');
await p.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(4000);
// A leftover session renders the signed-in view, which has no form.
const so = p.locator('button',{hasText:/SIGN OUT/i});
if (await so.count()) { await so.first().click(); await p.waitForTimeout(3000); }
await p.waitForSelector('input',{timeout:25000});
await p.locator('button',{hasText:/CREATE AN ACCOUNT/i}).first().click();
await p.waitForFunction(()=>document.querySelectorAll('input').length>=3,{timeout:15000});
const i=p.locator('input');
await i.nth(0).fill('Real Owner'); await i.nth(1).fill(email); await i.nth(2).fill('AuxWars!2026');
await p.locator('form button').last().click();
await p.waitForTimeout(9000);
const t = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('identity  :', /YOU ARE \| ([^|]+)/.exec(t)?.[1]?.trim());
console.log('collection:', /(YOUR COLLECTION · \d+|PREVIEW · SIGN IN TO OWN)/.exec(t)?.[1]);
console.log('drops     :', /DROPS \| (\d+)/.exec(t)?.[1]);
console.log('js errors :', errs.length?errs.slice(0,2):'none');
console.log('account   :', email);
await b.close();
