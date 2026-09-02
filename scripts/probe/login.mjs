import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const PASS = process.env.DEMO_PASS || 'auxwars2026';
console.log('=== SIGN IN WITH A CONFIRMED ACCOUNT ===');
await p.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p.waitForSelector('input',{timeout:25000});
const inp=p.locator('input');
await inp.nth(0).fill('maya@auxwars.demo');
await inp.nth(1).fill(PASS);
await p.locator('form button').last().click();
await p.waitForTimeout(6000);
console.log('after submit:', (await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '))).slice(0,150));

const st = await p.evaluate(()=>({
  keys:Object.keys(localStorage).filter(k=>/sb-|auth/i.test(k)),
  token:Object.values(localStorage).some(v=>/access_token/.test(v||'')),
}));
console.log('\nsession keys :', st.keys);
console.log('has token    :', st.token);

console.log('\n=== NEW TAB (session must carry) ===');
const p2=await ctx.newPage();
await p2.goto('http://localhost:3100/signin',{waitUntil:'domcontentloaded'});
await p2.waitForTimeout(3500);
const t=(await p2.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '))).slice(0,140);
console.log(t);
console.log('sign-out present:', await p2.locator('button',{hasText:/SIGN OUT/i}).count()>0);
await b.close();
