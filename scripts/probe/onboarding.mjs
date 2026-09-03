import { chromium } from 'playwright';
const B = 'http://localhost:3100';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
const email = `onb.${Date.now()}@gmail.com`;
const password = 'AuxWars!2026';

console.log('=== REGISTER A FRESH ACCOUNT ===', email);
await p.goto(B + '/signin', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
const so = p.locator('button', { hasText: /SIGN OUT/i });
if (await so.count()) { await so.first().click(); await p.waitForTimeout(2500); }
await p.waitForSelector('input', { timeout: 25000 });
await p.locator('button', { hasText: /CREATE AN ACCOUNT/i }).first().click();
await p.waitForFunction(() => document.querySelectorAll('input').length >= 3, { timeout: 15000 });
const i = p.locator('input');
await i.nth(0).fill('Onboarding Tester'); await i.nth(1).fill(email); await i.nth(2).fill(password);
await p.locator('form button').last().click();

console.log('\n=== SHOULD LAND ON /welcome ===');
await p.waitForURL(/\/welcome/, { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(2500);
console.log('url after signup:', p.url());
const landedOnWelcome = /\/welcome/.test(p.url());
console.log('landed on /welcome:', landedOnWelcome);

const greetText = await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
console.log('greet screen shows TEAR IT OPEN:', /TEAR IT OPEN/i.test(greetText));
console.log('greet screen shows display name:', /ONBOARDING TESTER/i.test(greetText.toUpperCase()));

console.log('\n=== TEAR IT OPEN, REVEAL THE 21 CARDS ===');
await p.locator('button', { hasText: /TEAR IT OPEN/i }).first().click();
await p.waitForTimeout(2500);

// Step through every card via the reveal tap target.
let cardCount = 0;
for (let n = 0; n < 25; n++) {
  const t = await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  const m = /CARD \d+ OF (\d+)/.exec(t);
  if (m) cardCount = parseInt(m[1], 10);
  if (/YOU.RE IN/i.test(t)) break;
  await p.locator('[role=button]').first().click().catch(() => {});
  await p.waitForTimeout(600);
}
console.log('starter pack card count (expect 21):', cardCount);

const doneText = await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
console.log('reached DONE stage (YOU\'RE IN):', /YOU.RE IN/i.test(doneText));
console.log('shows 500 drops:', /500/.test(doneText) && /DROPS/i.test(doneText));

console.log('\n=== FINISH SETS onboarded_at -- VERIFY VIA /deck NOT LOOPING BACK ===');
await p.locator('a', { hasText: /GO TO DECK/i }).first().click().catch(() => {});
await p.waitForTimeout(3000);
console.log('url after GO TO DECK:', p.url());
console.log('did not bounce back to /welcome:', !/\/welcome/.test(p.url()));

console.log('\n=== SIGN OUT, SIGN BACK IN -- SHOULD SKIP WELCOME ENTIRELY ===');
await p.goto(B + '/signin', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
const so2 = p.locator('button', { hasText: /SIGN OUT/i });
if (await so2.count()) { await so2.first().click(); await p.waitForTimeout(2500); }
await p.waitForSelector('input', { timeout: 25000 });
const i2 = p.locator('input');
await i2.nth(0).fill(email); await i2.nth(1).fill(password);
await p.locator('form button').last().click();
await p.waitForTimeout(4000);
console.log('url after sign back in:', p.url());
console.log('went straight to /deck:', /\/deck/.test(p.url()));
console.log('no welcome flash (final url has no /welcome):', !/\/welcome/.test(p.url()));

console.log('\njs errors:', errs.length ? errs.slice(0, 3) : 'none');
console.log('account  :', email);
await b.close();
