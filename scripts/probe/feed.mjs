/**
 * Verifies Task 6's FEED tab against the real database.
 *
 * No response interception and no stubbing: the three events and their
 * rooms live in Postgres (migration `seed_demo_events`), the anon client
 * reads them through the public `events_read` / `reigns_read` policies,
 * and this probe only reads what the browser rendered. A previous probe
 * was rejected for proving the rendering logic instead of the data path,
 * so the whole point here is that the bytes came from Supabase.
 *
 * Asserts: three tiles render; the live one carries its indicator; a tile
 * with no plays shows its poster gradient rather than a partial grid; and
 * tapping a tile reaches /events/{slug}.
 *
 * Model: scripts/probe/room-real.mjs. Needs a dev server on :3100.
 */
import { chromium } from 'playwright';

const B = 'http://localhost:3100';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));

await p.goto(B + '/feed', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('[data-feed-grid], [data-feed-skeleton]', { timeout: 20000 });
// The grid replaces the skeleton once the real fetch resolves.
await p.waitForSelector('[data-feed-grid]', { timeout: 20000 });

const tiles = await p.$$eval('[data-feed-grid] > a', (as) =>
  as.map((a) => {
    const poster = a.querySelector('div');
    const grid = a.querySelector('div > div[style*="grid-template-columns"]');
    return {
      href: a.getAttribute('href'),
      text: a.innerText.replace(/\n+/g, ' | '),
      gradient: poster ? getComputedStyle(poster).backgroundImage : '(none)',
      collageCells: grid ? grid.children.length : 0,
      livePulse: !!a.querySelector('[data-live-pulse]'),
    };
  }),
);

console.log('=== /feed against the real database (no interception) ===');
console.log('tiles rendered           :', tiles.length, tiles.length === 3 ? '(expected 3)' : '— EXPECTED 3');
for (const t of tiles) {
  console.log(`\n  ${t.href}`);
  console.log('    text        :', t.text);
  console.log('    live pulse  :', t.livePulse);
  console.log('    collage     :', t.collageCells === 0 ? 'none — falls back to gradient (correct, 0 reigns)' : `${t.collageCells} cells`);
  console.log('    gradient    :', t.gradient.slice(0, 72));
}

const live = tiles.filter((t) => t.livePulse);
console.log('\nexactly one live indicator:', live.length === 1 ? `yes (${live[0]?.href})` : `NO — ${live.length}`);
console.log('no partial grids          :', tiles.every((t) => t.collageCells === 0 || t.collageCells === 4) ? 'yes' : 'NO — a tile rendered 1-3 cells');
console.log('every gradient present    :', tiles.every((t) => t.gradient.includes('gradient')) ? 'yes' : 'NO');
console.log('formats shown             :', tiles.map((t) => t.text.split(' | ')[0]).join(', '));

// The tile must actually reach the event, because a night that opens into
// nothing is drift (CLAUDE.md §1.2).
const target = tiles.find((t) => t.livePulse) ?? tiles[0];
await p.click(`[data-feed-grid] > a[href="${target.href}"]`);
await p.waitForTimeout(2500);
const landed = new URL(p.url()).pathname.replace(/\/$/, '');
console.log('\ntap a tile ->             :', landed, landed === target.href ? '(correct)' : `— EXPECTED ${target.href}`);
console.log('event screen has content  :', (await p.innerText('body')).trim().length > 40 ? 'yes' : 'NO');
console.log('js errors                 :', errs.length ? errs.slice(0, 3) : 'none');

await b.close();
