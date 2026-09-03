import { chromium } from 'playwright';
const B = 'http://localhost:3100';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
const email = `shop.${Date.now()}@gmail.com`;

console.log('=== REGISTER (grants 500 Drops) ===', email);
await p.goto(B + '/signin', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
const so = p.locator('button', { hasText: /SIGN OUT/i });
if (await so.count()) { await so.first().click(); await p.waitForTimeout(2500); }
await p.waitForSelector('input', { timeout: 25000 });
await p.locator('button', { hasText: /CREATE AN ACCOUNT/i }).first().click();
await p.waitForFunction(() => document.querySelectorAll('input').length >= 3, { timeout: 15000 });
const i = p.locator('input');
await i.nth(0).fill('Shop Tester'); await i.nth(1).fill(email); await i.nth(2).fill('AuxWars!2026');
await p.locator('form button').last().click();
await p.waitForTimeout(8000);

const dropsOf = async () => {
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
  // The home stat block reads "500\nDROPS\n21\nCOLLECTION\n..." — the balance
  // is the number immediately BEFORE the DROPS label, not after it (a plain
  // forward search from "DROPS" lands on the COLLECTION count instead).
  const t = await p.evaluate(() => document.body.innerText);
  return /(\d+)\s*\nDROPS/.exec(t)?.[1] ?? '?';
};

console.log('\n=== SHOP: /packs while idle ===');
await p.goto(B + '/packs', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);
const idleText = await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
console.log('idle screen:', idleText.slice(0, 400));

const hasAllThree = /STARTER/i.test(idleText) && /NIGHT/i.test(idleText) && /HEADLINER/i.test(idleText);
console.log('all three tiers render:', hasAllThree);
console.log('shows costs 150/400/900:', /150/.test(idleText) && /400/.test(idleText) && /900/.test(idleText));

console.log('\n=== AFFORDABILITY on 500 Drops ===');
console.log('drops now:', await dropsOf());
await p.goto(B + '/packs', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3500);

const buttons = p.locator('button');
const btnCount = await buttons.count();
let starterBtn = null, nightBtn = null, headlinerBtn = null;
for (let idx = 0; idx < btnCount; idx++) {
  const t = (await buttons.nth(idx).innerText()).toUpperCase();
  if (t.includes('STARTER')) starterBtn = buttons.nth(idx);
  else if (t.includes('NIGHT')) nightBtn = buttons.nth(idx);
  else if (t.includes('HEADLINER')) headlinerBtn = buttons.nth(idx);
}
console.log('starter disabled:', starterBtn ? await starterBtn.isDisabled() : 'not found');
console.log('night disabled:', nightBtn ? await nightBtn.isDisabled() : 'not found');
console.log('headliner disabled:', headlinerBtn ? await headlinerBtn.isDisabled() : 'not found');
const headlinerText = headlinerBtn ? (await headlinerBtn.innerText()) : '';
console.log('headliner shows NEED 400 MORE:', /NEED\s+400\s+MORE/i.test(headlinerText));

console.log('\n=== OPEN A STARTER PACK ===');
if (starterBtn) {
  await starterBtn.click();
  await p.waitForTimeout(2500);
  for (let s = 0; s < 3; s++) { await p.locator('[role=button]').first().click(); await p.waitForTimeout(2500); }
  const after = await p.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  console.log('after opening:', after.slice(0, 200));
  console.log('shows STARTER label:', /STARTER/i.test(after));
  console.log('shows a card count:', /CARD \d+ OF \d+/.test(after));
  const cardCountMatch = /CARD \d+ OF (\d+)/.exec(after);
  console.log('card count in pack:', cardCountMatch?.[1] ?? '?', '(expect 3)');
} else {
  console.log('starter button not found — skipping open');
}

console.log('\ndrops after starter pack (expect 350):', await dropsOf());
console.log('js errors   :', errs.length ? errs.slice(0, 2) : 'none');
await b.close();
