import { chromium } from 'playwright';
const B='http://localhost:3100';
const b = await chromium.launch({ args:['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
let media=0; p.on('request',r=>{ if(/audio-ssl|\.m4a/.test(r.url())) media++; });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const email=`coll.${Date.now()}@gmail.com`;

// Register so there is a real collection to filter and play.
await p.goto(B+'/signin',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3500);
const so=p.locator('button',{hasText:/SIGN OUT/i});
if (await so.count()) { await so.first().click(); await p.waitForTimeout(2500); }
await p.waitForSelector('input',{timeout:25000});
await p.locator('button',{hasText:/CREATE AN ACCOUNT/i}).first().click();
await p.waitForFunction(()=>document.querySelectorAll('input').length>=3,{timeout:15000});
const i=p.locator('input');
await i.nth(0).fill('Coll Tester'); await i.nth(1).fill(email); await i.nth(2).fill('AuxWars!2026');
await p.locator('form button').last().click();
await p.waitForTimeout(9000);

await p.goto(B+'/profile',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(7000);
const t=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
console.log('binder:', /BINDER · (\d+)/.exec(t)?.[1] ?? '?', 'cards');

console.log('\n=== FINDING 1: does the FIRST tap play? ===');
const playable = p.locator('text=TAP TO PLAY');
const n = await playable.count();
console.log('playable cards:', n);

if (n) {
  // --- First tap starts playback ---
  await playable.first().click();
  await p.waitForTimeout(5000);
  let after=await p.evaluate(()=>document.body.innerText);
  console.log('media requests after ONE tap:', media, media>0?'(PLAYS)':'(SILENT — bug confirmed)');
  console.log('shows PLAYING badge:', /PLAYING/.test(after));

  // --- Tapping the SAME (now playing) card again stops it ---
  console.log('\n=== tapping the SAME card again: does it stop? ===');
  const stopLoc = p.locator('text=TAP TO STOP');
  const stopCount = await stopLoc.count();
  console.log('TAP TO STOP visible before second tap:', stopCount);
  if (stopCount) {
    await stopLoc.first().click();
    await p.waitForTimeout(1500);
    after = await p.evaluate(()=>document.body.innerText);
    console.log('PLAYING badge gone after stop tap:', !/PLAYING/.test(after));
  }

  // --- Tapping a DIFFERENT card switches without both playing ---
  console.log('\n=== tapping a DIFFERENT card: does it switch cleanly? ===');
  const playableNow = p.locator('text=TAP TO PLAY');
  const playableCount = await playableNow.count();
  if (playableCount >= 2) {
    const mediaBeforeFirst = media;
    await playableNow.first().click();
    await p.waitForTimeout(4000);
    after = await p.evaluate(()=>document.body.innerText);
    const playingBadgesAfterFirst = (after.match(/PLAYING/g) || []).length;
    console.log('media after tapping card A:', media, '(was', mediaBeforeFirst, ')');
    console.log('PLAYING badges after tapping card A:', playingBadgesAfterFirst);

    const mediaBeforeSecond = media;
    const stillPlayable = p.locator('text=TAP TO PLAY');
    await stillPlayable.first().click();
    await p.waitForTimeout(4000);
    after = await p.evaluate(()=>document.body.innerText);
    const playingBadgesAfterSecond = (after.match(/PLAYING/g) || []).length;
    console.log('media after tapping card B:', media, '(was', mediaBeforeSecond, ')');
    console.log('PLAYING badges after tapping card B (should be exactly 1, never 2):', playingBadgesAfterSecond);
  } else {
    console.log('not enough playable cards to test switching (need 2, have', playableCount, ')');
  }

  // --- FINDING 2: filtering the playing card out of view stops it ---
  console.log('\n=== FINDING 2: filtering the playing card out of view ===');
  after = await p.evaluate(()=>document.body.innerText);
  const wasPlaying = /PLAYING/.test(after);
  console.log('a card is playing before filter change:', wasPlaying);
  if (wasPlaying) {
    // Flip through rarity chips until the playing card's badge disappears
    // from view, or we've tried them all.
    const chips = ['LEGENDARY','EPIC','RARE','COMMON'];
    let filteredOut = false;
    for (const label of chips) {
      const chip = p.locator('button', { hasText: new RegExp('^'+label) });
      if (await chip.count()) {
        await chip.first().click();
        await p.waitForTimeout(1500);
        const domText = await p.evaluate(()=>document.body.innerText);
        if (!/PLAYING/.test(domText)) { filteredOut = true; break; }
      }
    }
    await p.waitForTimeout(1000);
    const isPausedNow = await p.evaluate(() => {
      const a = document.querySelector('audio');
      return a ? a.paused : true;
    });
    console.log('playing card left the filtered view:', filteredOut);
    console.log('audio element paused after filter removed it from view:', isPausedNow);
    const domAfter = await p.evaluate(()=>document.body.innerText);
    console.log('PLAYING badge still in DOM after filter change:', /PLAYING/.test(domAfter));
  }
}

console.log('\njs errors:', errs.length?errs.slice(0,2):'none');
await b.close();
