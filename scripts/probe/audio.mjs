import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,90)));

await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:35000});
await p.waitForTimeout(3000);

console.log('=== AUDIO PLAYBACK TEST ===\n');
const card = p.locator('[aria-label^="Play "]').first();
if (await card.count()) { await card.click(); await p.waitForTimeout(1800); }

// Is there an <audio> element with a real Apple src?
const audioInfo = await p.evaluate(() => {
  const a = document.querySelector('audio');
  return a ? { src: a.src.slice(0,60), paused: a.paused, readyState: a.readyState } : null;
});
console.log('audio element   :', audioInfo ? 'PRESENT' : 'none');
if (audioInfo) console.log('  src           :', audioInfo.src + '…');

const status = await p.locator('text=/PREVIEW · 30s|PLAYING|BUFFERING|UNAVAILABLE|LOADING/').first().textContent().catch(()=>null);
console.log('status label    :', status ?? 'none');

// Press the play button and see if it actually starts
const playBtn = p.locator('[aria-label^="Play "], [aria-label^="Pause "]').last();
if (await playBtn.count()) {
  await playBtn.click();
  await p.waitForTimeout(3500);
  const after = await p.evaluate(() => {
    const a = document.querySelector('audio');
    return a ? { paused: a.paused, currentTime: +a.currentTime.toFixed(2), duration: +(a.duration||0).toFixed(1) } : null;
  });
  console.log('\nafter pressing play:');
  console.log('  paused        :', after?.paused);
  console.log('  currentTime   :', after?.currentTime, 's');
  console.log('  duration      :', after?.duration, 's');
  console.log('  >>> AUDIO IS', after && !after.paused && after.currentTime > 0 ? 'PLAYING ✓' : 'NOT PLAYING ✗');
}
console.log('\njs errors:', errs.length ? errs.slice(0,3) : 'none');
await b.close();
