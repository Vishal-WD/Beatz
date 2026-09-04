import { chromium } from 'playwright';
const B='http://localhost:3100';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const email=`pack.${Date.now()}@gmail.com`;

console.log('=== REGISTER (grants 500 Drops) ===', email);
await p.goto(B+'/signin',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3500);
const so=p.locator('button',{hasText:/SIGN OUT/i});
if (await so.count()) { await so.first().click(); await p.waitForTimeout(2500); }
await p.waitForSelector('input',{timeout:25000});
await p.locator('button',{hasText:/CREATE AN ACCOUNT/i}).first().click();
await p.waitForFunction(()=>document.querySelectorAll('input').length>=3,{timeout:15000});
const i=p.locator('input');
await i.nth(0).fill('Pack Tester'); await i.nth(1).fill(email); await i.nth(2).fill('AuxWars!2026');
await p.locator('form button').last().click();
await p.waitForTimeout(8000);

const dropsOf = async () => {
  await p.goto(B+'/',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500);
  const t = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
  return /DROPS[^0-9]{0,12}(\d+)/i.exec(t)?.[1] ?? '?';
};
console.log('drops before:', await dropsOf());

console.log('\n=== OPEN A PACK ===');
await p.goto(B+'/packs',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3500);
console.log('sealed:', (await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '))).slice(0,110));
for (let s=0;s<4;s++){ await p.locator('[role=button]').first().click(); await p.waitForTimeout(2500); }
const after = await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('after opening:', after.slice(0,170));
console.log('shows a card count:', /CARD \d+ OF \d+/.test(after));
console.log('\ndrops after :', await dropsOf());
console.log('js errors   :', errs.length?errs.slice(0,2):'none');
await b.close();
