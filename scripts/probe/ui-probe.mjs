import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,110)); });
p.on('pageerror', e => errs.push('PAGEERROR: '+e.message.slice(0,110)));
const go = async r => p.goto('http://localhost:3000'+r, {waitUntil:'networkidle', timeout:30000});

console.log('=== REAL BROWSER 390x844 ===\n');
await go('/');
console.log('/        nav:', await p.locator('nav').count() > 0, ' links:', await p.locator('a').count());

await go('/deck');
await p.waitForTimeout(2500);
const badge = await p.locator('text=/LOADING POOL|LOCAL POOL|LIVE POOL/').first().textContent().catch(()=>null);
console.log('\n/deck    badge:', badge ?? 'NONE');
console.log('/deck    nav visible:', await p.locator('nav').isVisible().catch(()=>false));
const cards = await p.locator('[aria-label^="Play "]').count();
console.log('/deck    cards in hand:', cards);

if (cards) {
  await p.locator('[aria-label^="Play "]').first().click();
  await p.waitForTimeout(1200);
  console.log('/deck    TAP card -> slot fills:', (await p.locator('text=RETURN TO HAND').count()) > 0 ? 'YES' : 'NO');
  console.log('/deck    hand', cards, '->', await p.locator('[aria-label^="Play "]').count());
}
const vB = await p.locator('[role="meter"]').getAttribute('aria-valuenow').catch(()=>null);
const hold = p.locator('[aria-label*="Hold to raise"]');
if (await hold.count()) {
  await hold.hover(); await p.mouse.down(); await p.waitForTimeout(2200); await p.mouse.up();
  const vA = await p.locator('[role="meter"]').getAttribute('aria-valuenow').catch(()=>null);
  console.log('/deck    HOLD vibe:', vB, '->', vA, vB!==vA ? '(responds)' : '(NO CHANGE)');
}
console.log('\njs errors:', errs.length ? errs.slice(0,4) : 'none');
await b.close();
