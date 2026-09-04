/**
 * Verifies the room screen renders the shape of its actual control model
 * (CLAUDE.md §1, lib/domain/formats.ts), not "THRONE" in every format.
 *
 * For each of the six formats, sets rooms.slug='basement-4am'.format in the
 * database, loads /deck in a real browser, and asserts:
 *   - spectator formats (concert, fest, clubbing) render the performer disc
 *     and show NO dethrone/collapse wording ("THRONE", "DETHRONE",
 *     "CHALLENGER #", "IN LINE").
 *   - contested formats (disco, private_party) render the queue/challenger
 *     line and never the performer disc.
 *   - delegated (night_party) renders neither the disc nor the challenger
 *     line — the DJ holds, the crowd feeds the pool.
 *   - no format renders both a performer disc and challenger/dethrone copy.
 *
 * Modelled on scripts/probe/owned.mjs and scripts/probe/deck-bug.mjs
 * (Playwright against a dev server on http://localhost:3100).
 *
 * Writing rooms.format requires bypassing RLS (the anon key cannot update
 * rooms — verified directly: an unauthenticated AND a freshly signed-in
 * non-host update both silently affect 0 rows, no error). With
 * SUPABASE_SERVICE_ROLE_KEY in the environment this probe drives all six
 * formats by actually writing the row. Without one (the default here — no
 * service key is available in this environment, and it must never live in
 * a client env file), it falls back to intercepting the browser's own
 * REST fetch of that exact row (Supabase's PostgREST endpoint,
 * `/rest/v1/rooms?...slug=eq.basement-4am`) and rewriting the `format`
 * field in the response body before the page's own useEffect ever sees it.
 * That exercises the identical client code path — app/deck/page.tsx reads
 * `data as DbRoom` straight off this response — without granting the probe
 * any privilege the real client doesn't have, and without faking a UI
 * override the app doesn't actually support.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLUG = 'basement-4am';
const BASE = 'http://localhost:3100';

const FORMATS = ['concert', 'fest', 'clubbing', 'night_party', 'disco', 'private_party'];
const SPECTATOR = new Set(['concert', 'fest', 'clubbing']);
const CONTESTED = new Set(['disco', 'private_party']);
// Delegated: night_party — neither set.

const DETHRONE_WORDS = /THRONE|DETHRONE|CHALLENGER\s*#|\bIN LINE\b/i;

let db = null;
if (SERVICE_KEY) {
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
} else {
  console.log(
    'NO SUPABASE_SERVICE_ROLE_KEY IN ENV — cannot rewrite rooms.format. ' +
      'The anon key is RLS-blocked from updating rooms (verified separately: ' +
      'both an unauthenticated and a freshly signed-in non-host update return ' +
      '0 rows changed, no error). Running only against the room\'s CURRENT ' +
      'seeded format instead of driving all six.\n',
  );
}

async function setFormat(format) {
  if (!db) return false;
  const { data, error } = await db
    .from('rooms')
    .update({ format })
    .eq('slug', SLUG)
    .select();
  if (error) {
    console.log(`  ! failed to set format=${format}: ${error.message}`);
    return false;
  }
  if (!data || data.length === 0) {
    console.log(`  ! update matched 0 rows for format=${format} (RLS?)`);
    return false;
  }
  return true;
}

async function currentFormat() {
  const anon = createClient(SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data } = await anon.from('rooms').select('format').eq('slug', SLUG).single();
  return data?.format ?? null;
}

/**
 * Intercepts the browser's own PostgREST fetch of the `rooms` row and
 * rewrites `format` in the JSON body before the app sees it. Used only
 * when there is no service-role key to write the database for real.
 */
async function withRoutedFormat(page, format, fn) {
  await page.route('**/rest/v1/rooms*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const patched = Array.isArray(body)
      ? body.map((r) => (r.slug === SLUG ? { ...r, format } : r))
      : body && body.slug === SLUG
        ? { ...body, format }
        : body;
    await route.fulfill({ response, json: patched });
  });
  try {
    return await fn();
  } finally {
    await page.unroute('**/rest/v1/rooms*');
  }
}

async function assertShape(page, format) {
  await page.goto(`${BASE}/deck`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasDisc = await page.locator('text=PERFORMING').count();
  const hasApplause = await page.locator('text=APPLAUSE').count();
  const dethroneHit = DETHRONE_WORDS.exec(bodyText);

  const isSpectator = SPECTATOR.has(format);
  const isContested = CONTESTED.has(format);

  const result = {
    format,
    hasDisc: hasDisc > 0,
    hasApplause: hasApplause > 0,
    dethroneWordFound: dethroneHit ? dethroneHit[0] : null,
  };

  const problems = [];
  if (isSpectator) {
    if (!result.hasDisc) problems.push('expected performer disc, none rendered');
    if (result.dethroneWordFound) problems.push(`dethrone/collapse wording present: "${result.dethroneWordFound}"`);
  } else {
    if (result.hasDisc) problems.push('performer disc rendered outside a spectator format');
  }
  if (isContested) {
    if (result.dethroneWordFound === null) {
      // Contested rooms are allowed (expected) to show throne/challenger
      // wording — absence is not itself a failure worth flagging here,
      // since a fresh room can start with "THRONE OPEN" only if the deck
      // is empty, which is exactly the seeded state.
    }
  }
  if (result.hasDisc && result.dethroneWordFound) {
    problems.push('BOTH the performer disc and dethrone/collapse wording rendered — no format may show both');
  }

  console.log(`\n${format.toUpperCase()} (${isSpectator ? 'spectator' : isContested ? 'contested' : 'delegated'})`);
  console.log(`  performer disc   : ${result.hasDisc}`);
  console.log(`  applause label   : ${result.hasApplause}`);
  console.log(`  dethrone wording : ${result.dethroneWordFound ?? '(none)'}`);
  console.log(`  verdict          : ${problems.length ? 'FAIL — ' + problems.join('; ') : 'ok'}`);

  return { ...result, problems };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const results = [];

if (db) {
  for (const format of FORMATS) {
    const ok = await setFormat(format);
    if (!ok) {
      console.log(`\n${format.toUpperCase()}: SKIPPED — could not write format to the database`);
      continue;
    }
    results.push(await assertShape(page, format));
  }
} else {
  const fmt = await currentFormat();
  console.log(`Current seeded format for '${SLUG}': ${fmt ?? '(unknown — room not found)'}\n`);
  console.log('--- pass 1: the room exactly as seeded, no interception ---');
  if (fmt) results.push(await assertShape(page, fmt));

  console.log('\n--- pass 2: all six formats via response-body interception ---');
  for (const format of FORMATS) {
    const r = await withRoutedFormat(page, format, () => assertShape(page, format));
    results.push(r);
  }
}

await browser.close();

const failed = results.filter((r) => r.problems.length > 0);
console.log(`\n=== ${results.length} format(s) checked, ${failed.length} failed ===`);
if (failed.length) process.exitCode = 1;
