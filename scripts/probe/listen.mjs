import { chromium } from 'playwright';
// Autoplay must be allowed to simulate the user's real tap on a device.
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const media=[]; p.on('request',r=>{ if(/audio-ssl|mzstatic.*\.m4a|\.m4a/.test(r.url())) media.push(r.url()); });

await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(3000);
console.log('=== CAN A USER ACTUALLY LISTEN? ===\n');

await p.locator('[aria-label^="Play "]').first().click();  // put card on deck
await p.waitForTimeout(1200);
const btn = p.locator('[aria-label^="Play "]').last();
await btn.click();                                          // press play
await p.waitForTimeout(5000);

const s = await p.evaluate(()=>{
  const a=[...document.querySelectorAll('audio')];
  const el=[...document.querySelectorAll('*')].filter(n=>!n.children.length)
    .map(n=>n.textContent.trim()).find(t=>/PLAYING|PREVIEW|BUFFERING|UNAVAILABLE|ENDED/.test(t));
  return { label:el||'none', audios:a.length };
});
console.log('media requests to Apple :', media.length);
if (media[0]) console.log('  ', media[0].slice(0,70)+'…');
console.log('status label            :', s.label);
console.log('progress advanced       :', await p.evaluate(()=>{
  const t=[...document.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.textContent.trim());
  return t.find(x=>/^0:[0-9]{2}$/.test(x)) ?? 'no timer';
}));
await b.close();
