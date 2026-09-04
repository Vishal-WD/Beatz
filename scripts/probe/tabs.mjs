// Verifies the five icon tabs are real tap targets on a phone viewport:
// every tab at least 44px tall, and the five within a few px of equal width.
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));

await p.goto('http://localhost:3100/deck', { waitUntil: 'domcontentloaded', timeout: 20000 });
await p.waitForTimeout(900);

const boxes = await p.evaluate(() => {
  const nav = document.querySelector('nav');
  if (!nav) return null;
  const links = [...nav.querySelectorAll('a[href]')];
  return links.map((a) => {
    const r = a.getBoundingClientRect();
    return { href: a.getAttribute('href'), width: r.width, height: r.height };
  });
});

console.log('=== TAB BAR TAP TARGETS (390x844) ===\n');
if (!boxes || boxes.length === 0) {
  console.log('FAILED: no <nav> tabs found on /deck');
  await b.close();
  process.exit(1);
}

let ok = true;
for (const box of boxes) {
  const heightOk = box.height >= 44;
  if (!heightOk) ok = false;
  console.log(`${(box.href ?? '').padEnd(12)} w:${box.width.toFixed(1).padStart(6)}  h:${box.height.toFixed(1).padStart(6)}  ${heightOk ? '' : '⚠ SHORT'}`);
}

const widths = boxes.map((b) => b.width);
const maxW = Math.max(...widths);
const minW = Math.min(...widths);
const widthSpread = maxW - minW;
const widthOk = widthSpread <= 3;
if (!widthOk) ok = false;

console.log(`\ncount: ${boxes.length}  width spread: ${widthSpread.toFixed(2)}px  ${widthOk ? '' : '⚠ UNEVEN'}`);
console.log('js errors:', errs.length ? errs.slice(0, 4) : 'none');

if (boxes.length !== 5) {
  console.log(`FAILED: expected 5 tabs, found ${boxes.length}`);
  ok = false;
}

await b.close();
console.log(ok ? '\nPASS' : '\nFAIL');
process.exit(ok ? 0 : 1);
