import { chromium } from 'playwright';
const U='https://beatz-kappa.vercel.app';
const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const p=await ctx.newPage();
const errs=[]; let media=0;
p.on('pageerror',e=>errs.push(e.message));
p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media++; });
const email=`live.${Date.now()}@gmail.com`;

console.log('=== 1. REGISTER on the live site ===');
await p.goto(U+'/signin',{waitUntil:'domcontentloaded',timeout:40000});
await p.waitForSelector('input',{timeout:30000});
await p.locator('button',{hasText:/CREATE AN ACCOUNT/i}).first().click();
await p.waitForFunction(()=>document.querySelectorAll('input').length>=3,{timeout:20000});
const i=p.locator('input');
await i.nth(0).fill('Live Tester'); await i.nth(1).fill(email); await i.nth(2).fill('AuxWars!2026');
await p.locator('form button').last().click();
await p.waitForTimeout(9000);
const t1=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('after signup:', t1.slice(0,150));

console.log('\n=== 2. STARTER PACK + DROPS ===');
await p.goto(U+'/profile',{waitUntil:'domcontentloaded',timeout:40000});
await p.waitForTimeout(6000);
const t2=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('binder:', /BINDER · (\d+) CARD/.exec(t2)?.[1] ?? '?', 'cards');

console.log('\n=== 3. PLAY A SONG ===');
await p.goto(U+'/deck',{waitUntil:'domcontentloaded',timeout:40000});
await p.waitForTimeout(6000);
const hand=p.locator('button[aria-label^="Play "]');
if (await hand.count()) {
  await hand.last().click(); await p.waitForTimeout(2000);
  const play=p.locator('button[aria-label^="Play "]').first();
  if(!(await play.isDisabled())){ await play.click(); await p.waitForTimeout(6000); }
}
const t3=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('status:', /(PLAYING|BUFFERING|PREVIEW · 30s|UNAVAILABLE)/.exec(t3)?.[1] ?? 'none');
console.log('room mode:', /(LIVE ROOM|SOLO PRACTICE)/.exec(t3)?.[1] ?? '?');
console.log('media requests to Apple:', media);
console.log('\njs errors:', errs.length?errs.slice(0,2):'none');
console.log('ACCOUNT:', email);
await b.close();
