import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const media=[]; p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media.push(r.url()); });
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(3000);
await p.locator('[aria-label^="Play "]').first().click();   // card -> deck
await p.waitForTimeout(1500);

const play = p.locator('button[aria-label^="Play "]').first(); // NowPlaying button
console.log('=== USER PRESSES PLAY ===\n');
console.log('button disabled?', await play.isDisabled());
await play.click();
await p.waitForTimeout(6000);

const s = await p.evaluate(()=>{
  const t=[...document.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.textContent.trim());
  return { label:t.find(x=>/PLAYING|PREVIEW|BUFFERING|UNAVAILABLE|ENDED/.test(x))||'none',
           timer:t.filter(x=>/^\d:\d\d$/.test(x)) };
});
console.log('media requests  :', media.length, media[0]?media[0].slice(0,60)+'…':'');
console.log('status label    :', s.label);
console.log('timers on screen:', s.timer.join(' / '));
await b.close();
