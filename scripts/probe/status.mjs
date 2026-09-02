import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,90)));
const go = r => p.goto('http://localhost:3000'+r,{waitUntil:'networkidle',timeout:35000});

console.log('=== IS IT WORKING? real browser, 390x844 ===\n');

// DECK — the core screen
await go('/deck'); await p.waitForTimeout(3000);
const cards = await p.locator('[aria-label^="Play "]').count();
console.log('DECK');
console.log('  cards in hand      ', cards);
console.log('  data source        ', await p.locator('text=/LIVE POOL|LOCAL POOL|LOADING/').first().textContent().catch(()=>'none'));
console.log('  nav bar visible    ', await p.locator('nav').isVisible().catch(()=>false));

if (cards) {
  await p.locator('[aria-label^="Play "]').first().click();
  await p.waitForTimeout(1500);
  console.log('  TAP card -> plays  ', (await p.locator('text=RETURN TO HAND').count())>0 ? 'YES' : 'no');
}
const v1 = await p.locator('[role="meter"]').getAttribute('aria-valuenow').catch(()=>null);
const hold = p.locator('[aria-label*="Hold to raise"]');
if (await hold.count()) {
  await hold.hover(); await p.mouse.down(); await p.waitForTimeout(2200); await p.mouse.up();
  const v2 = await p.locator('[role="meter"]').getAttribute('aria-valuenow').catch(()=>null);
  console.log('  HOLD vibe          ', v1,'->',v2, v1!==v2?'RESPONDS':'no change');
}
// audio element present?
await p.waitForTimeout(2500);
console.log('  youtube player     ', p.frames().filter(f=>/youtube/.test(f.url())).length ? 'MOUNTED' : 'not mounted');

// PACKS — 4-stage tap
await go('/packs'); await p.waitForTimeout(1200);
const before = await p.locator('text=/SEALED|TEARING|FLIPPING|LEGENDARY PULL/').first().textContent().catch(()=>'?');
await p.locator('body').click({position:{x:195,y:400}}); await p.waitForTimeout(900);
const after = await p.locator('text=/SEALED|TEARING|FLIPPING|LEGENDARY PULL/').first().textContent().catch(()=>'?');
console.log('\nPACKS');
console.log('  tap advances stage ', before,'->',after, before!==after?'YES':'no');

// PROFILE — does the binder show the new cards?
await go('/profile'); await p.waitForTimeout(3000);
console.log('\nPROFILE');
const binder = await p.locator('text=/BINDER/').first().textContent().catch(()=>'?');
console.log('  binder             ', binder);
console.log('  album art loaded   ', await p.locator('img[alt^="Album art"]').count(), 'images');

// EVENTS
await go('/events'); await p.waitForTimeout(2500);
console.log('\nEVENTS');
console.log('  event cards        ', await p.locator('text=/RSVP|GOING|INTERESTED/').count());

console.log('\nJS ERRORS:', errs.length ? errs.slice(0,3) : 'NONE');
await b.close();
