import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
await p.goto('http://localhost:3000/deck',{waitUntil:'networkidle',timeout:35000});
await p.waitForTimeout(3500);

// Tap a card so NowPlaying mounts, then read what it decided.
await p.locator('[aria-label^="Play "]').first().click();
await p.waitForTimeout(2000);

console.log('=== AFTER TAPPING A CARD ===\n');
const status = await p.evaluate(() => {
  const all=[...document.querySelectorAll('*')];
  const el=all.find(n=>n.children.length===0 && /PREVIEW|PLAYING|BUFFERING|UNAVAILABLE|LOADING|PAUSED|NO PLAYBACK/.test(n.textContent||''));
  return el ? el.textContent.trim() : 'NOT FOUND';
});
console.log('status label      :', status);

// Which card is in the deck slot, and does it carry a preview?
const info = await p.evaluate(() => {
  const t=[...document.querySelectorAll('*')].filter(n=>n.children.length===0).map(n=>n.textContent.trim());
  return { hasReturn: t.includes('RETURN TO HAND'), sample: t.filter(x=>x && x.length>2 && x.length<40).slice(0,14) };
});
console.log('deck slot filled  :', info.hasReturn);
console.log('visible text      :', info.sample.join(' | ').slice(0,180));
await b.close();
