import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,100)));
// Watch for the actual media request to Apple — that proves playback started.
const media=[]; p.on('request',r=>{ if(/audio-ssl\.itunes|\.m4a/.test(r.url())) media.push(r.url().slice(0,55)); });

await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:35000});
await p.waitForTimeout(2500);
const card = p.locator('[aria-label^="Play "]').first();
if (await card.count()) { await card.click(); await p.waitForTimeout(1800); }

console.log('=== does pressing play fetch audio from Apple? ===\n');
const btn = p.locator('[aria-label^="Play "], [aria-label^="Pause "]').last();
console.log('play button found:', await btn.count() > 0);
if (await btn.count()) {
  await btn.click();
  await p.waitForTimeout(4000);
}
console.log('media requests to Apple:', media.length);
media.slice(0,2).forEach(u=>console.log('  ', u+'…'));
console.log('status now:', await p.locator('text=/PREVIEW · 30s|PLAYING|BUFFERING|UNAVAILABLE|ENDED/').first().textContent().catch(()=>'?'));
console.log('js errors:', errs.length?errs.slice(0,3):'none');
await b.close();
