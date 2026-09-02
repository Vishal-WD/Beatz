import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
let media=0; const errs=[];
p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media++; });
p.on('pageerror',e=>errs.push(e.message));
console.log('=== THE ACTUAL APK BUNDLE (static export) ===\n');
await p.goto('http://localhost:56302/deck',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(4000);
const cards = await p.locator('button[aria-label^="Play "]').count();
console.log('cards rendered from live Supabase:', cards);
if (cards) {
  await p.locator('button[aria-label^="Play "]').last().click();
  await p.waitForTimeout(1200);
  const play=p.locator('button[aria-label^="Play "]').first();
  console.log('play disabled?', await play.isDisabled());
  await play.click();
  await p.waitForTimeout(5000);
  const label = await p.evaluate(()=>[...document.querySelectorAll('*')].filter(n=>!n.children.length)
    .map(n=>n.textContent.trim()).find(x=>/PLAYING|BUFFERING|UNAVAILABLE|PREVIEW/.test(x))||'?');
  console.log('status:', label, '| media requests:', media);
}
console.log('js errors:', errs.length?errs.slice(0,3):'none');
await b.close();
