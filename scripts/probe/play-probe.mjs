import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,100)));
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(2000);

// play a card so NowPlaying mounts
const card = p.locator('[aria-label^="Play "]').first();
if (await card.count()) { await card.click(); await p.waitForTimeout(1500); }

console.log('=== PLAYBACK ===');
const playBtn = p.locator('[aria-label^="Play "], [aria-label^="Pause "]').last();
console.log('play control present:', await playBtn.count() > 0);
const status = await p.locator('text=/LOADING…|PLAYING|PAUSED|BUFFERING|UNAVAILABLE/').first().textContent().catch(()=>null);
console.log('player status text:', status ?? 'none');

// does the YouTube iframe actually mount?
await p.waitForTimeout(3000);
const frames = p.frames().filter(f=>/youtube/.test(f.url()));
console.log('youtube iframes mounted:', frames.length);
if (frames.length) console.log('  src:', frames[0].url().slice(0,70));
console.log('page errors:', errs.length?errs.slice(0,3):'none');
await b.close();
