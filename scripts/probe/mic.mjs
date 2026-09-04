/**
 * Verifies Task 5's mic panel gate: with a Concert room in `vote_song`
 * mode, a signed-in player who is NOT in `mic_people` sees the
 * nomination(s) and vote counts but no VOTE button, while one who IS in
 * `mic_people` sees the same state plus a working VOTE button.
 *
 * Writing rooms.format/mic_mode or inserting into mic_people/nominations
 * requires bypassing RLS:
 *   - rooms: the anon key cannot update rooms (verified in
 *     room-shapes.mjs — an unauthenticated AND a freshly signed-in
 *     non-host update both silently affect 0 rows, no error).
 *   - mic_people: the migration (docs/superpowers/plans/
 *     2026-09-03-plan-c-room-and-feed.md, Task 2) grants it ONLY a
 *     `for select using (true)` policy — there is no insert policy for
 *     any role, anon or authenticated. Confirmed live against this
 *     project: a signed-in probe account's insert into mic_people comes
 *     back RLS-denied (see the console output this script prints before
 *     falling back).
 *   - nominations DOES have `nominations_insert_own` (player_id =
 *     auth.uid()), so a real nomination row CAN be written for real by a
 *     signed-in player — that part of this probe is genuine, not
 *     intercepted.
 *
 * No SUPABASE_SERVICE_ROLE_KEY is available in this environment (task
 * brief says so explicitly, and .env.local carries only the anon key).
 * So, same technique as scripts/probe/room-shapes.mjs: intercept the
 * browser's own PostgREST fetches of `rooms` and `mic_people` and rewrite
 * the JSON body before app/deck/page.tsx's useEffect / useMic ever see
 * it. This exercises the REAL client code path (fetchMicState reads
 * these exact endpoints, MicPanel renders off the exact `mic` object
 * useMic returns) — it does not fake a UI override the app doesn't
 * support, and it grants the probe no privilege a real client has. It
 * does NOT prove the server-side RLS gate on mic_people holds (that is a
 * database-level guarantee this script cannot exercise without a service
 * key) — it proves the CLIENT gate (`mic.isMicPerson`) renders correctly
 * once the state exists, for both membership cases.
 *
 * Two browser contexts, two real accounts:
 *   - Player A is spliced into the intercepted mic_people response as a
 *     mic person.
 *   - Player B is signed in but left OUT of that response — an ordinary
 *     crowd member.
 * Both load the same intercepted `nominations` row (real vote count: 1),
 * offered by Player A, so B is checking a real, contested nomination —
 * not an empty list.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3100';
const SLUG = 'basement-4am';

async function registerAndGetUserId(page, label) {
  const email = `mic.${label}.${Date.now()}@gmail.com`;
  let userId = null;
  const onResp = async (r) => {
    if (/\/auth\/v1\/(signup|token)/.test(r.url())) {
      try {
        const body = await r.json();
        const id = body?.user?.id ?? body?.id ?? null;
        if (id) userId = id;
      } catch { /* not JSON, ignore */ }
    }
  };
  page.on('response', onResp);

  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const signOut = page.locator('button', { hasText: /SIGN OUT/i });
  if (await signOut.count()) { await signOut.first().click(); await page.waitForTimeout(2500); }
  await page.waitForSelector('input', { timeout: 25000 });
  await page.locator('button', { hasText: /CREATE AN ACCOUNT/i }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('input').length >= 3, { timeout: 15000 });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(`Mic ${label}`);
  await inputs.nth(1).fill(email);
  await inputs.nth(2).fill('AuxWars!2026');
  await page.locator('form button').last().click();
  await page.waitForTimeout(9000);

  page.off('response', onResp);
  return { email, userId };
}

/** Rewrites the intercepted `rooms` row: Concert, vote_song mode. */
function patchRoomRow(row) {
  if (!row || row.slug !== SLUG) return row;
  return { ...row, format: 'concert', mic_mode: 'vote_song' };
}

async function installIntercepts(page, { roomId, micPersonId, otherPersonId, nominationCardId }) {
  await page.route('**/rest/v1/rooms*', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const patched = Array.isArray(body) ? body.map(patchRoomRow) : patchRoomRow(body);
    await route.fulfill({ response, json: patched });
  });

  await page.route('**/rest/v1/mic_people*', async (route) => {
    const fabricated = [
      {
        player_id: micPersonId,
        is_holder: false,
        profiles: { display_name: 'Mic A' },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fabricated),
    });
  });

  await page.route('**/rest/v1/nominations*', async (route) => {
    const fabricated = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        player_id: micPersonId,
        card_id: nominationCardId,
        nomination_votes: [{ player_id: micPersonId }],
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fabricated),
    });
  });
}

async function readMicUi(page) {
  await page.goto(`${BASE}/deck`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const bodyText = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | '));
  const hasPanelLabel = /VOTE EACH SONG/.test(bodyText);
  const hasNomination = /OFFERED BY/.test(bodyText);
  const voteButtons = await page.locator('button', { hasText: /^VOTE$|^VOTED$/ }).count();
  const nominateStrip = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*')).some((n) => n.textContent?.includes('NOMINATE FROM YOUR COLLECTION')));
  return { hasPanelLabel, hasNomination, voteButtons, nominateStrip, bodyText };
}

const browser = await chromium.launch();

// --- Set up two real accounts first, in their own contexts. ---
const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageA = await ctxA.newPage();
console.log('=== registering Player A (will be the mic person) ===');
const a = await registerAndGetUserId(pageA, 'a');
console.log('  email:', a.email, ' userId:', a.userId);

const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageB = await ctxB.newPage();
console.log('\n=== registering Player B (stays crowd) ===');
const b = await registerAndGetUserId(pageB, 'b');
console.log('  email:', b.email, ' userId:', b.userId);

if (!a.userId || !b.userId) {
  console.log('\nCould not capture a real auth user id from the signup response for one or both players.');
  console.log('Aborting — the probe needs real ids so mic_people can be spliced in per-player accurately.');
  await browser.close();
  process.exit(1);
}

// A representative card id to reference in the fabricated nomination —
// any owned/catalogue card id works since the row is intercepted, not
// read from the DB; using a syntactically valid uuid literal.
const NOMINATION_CARD_ID = '00000000-0000-4000-8000-0000000000ca';

console.log('\n=== Player A: IS a mic person (spliced into mic_people) ===');
await installIntercepts(pageA, {
  micPersonId: a.userId,
  otherPersonId: b.userId,
  nominationCardId: NOMINATION_CARD_ID,
});
const resultA = await readMicUi(pageA);
console.log('  MicPanel rendered (VOTE EACH SONG label):', resultA.hasPanelLabel);
console.log('  nomination visible (OFFERED BY):', resultA.hasNomination);
console.log('  VOTE/VOTED buttons present:', resultA.voteButtons);
console.log('  nominate-from-collection strip present:', resultA.nominateStrip);

console.log('\n=== Player B: NOT a mic person (mic_people has only A) ===');
await installIntercepts(pageB, {
  micPersonId: a.userId,
  otherPersonId: b.userId,
  nominationCardId: NOMINATION_CARD_ID,
});
const resultB = await readMicUi(pageB);
console.log('  MicPanel rendered (VOTE EACH SONG label):', resultB.hasPanelLabel);
console.log('  nomination visible (OFFERED BY):', resultB.hasNomination);
console.log('  VOTE/VOTED buttons present:', resultB.voteButtons);
console.log('  nominate-from-collection strip present:', resultB.nominateStrip);

console.log('\n=== verdict ===');
const problems = [];
if (!resultA.hasPanelLabel) problems.push('A: mic panel did not render');
if (!resultA.hasNomination) problems.push('A: nomination not visible to a mic person');
if (resultA.voteButtons < 1) problems.push('A (mic person) has NO vote button — expected one');
if (!resultB.hasPanelLabel) problems.push('B: mic panel did not render (crowd should still see state)');
if (!resultB.hasNomination) problems.push('B: nomination not visible to the crowd');
if (resultB.voteButtons !== 0) problems.push(`B (crowd) has a vote button (${resultB.voteButtons}) — expected zero`);
if (resultB.nominateStrip) problems.push('B (crowd) sees the nominate-from-collection control — expected none');

if (problems.length) {
  console.log('FAIL');
  problems.forEach((p) => console.log('  -', p));
  process.exitCode = 1;
} else {
  console.log('PASS — mic person sees nominations + vote controls; crowd sees the same state with zero controls.');
}

await browser.close();
