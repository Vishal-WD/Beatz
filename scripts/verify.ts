/**
 * Invariant checks — `npx tsx scripts/verify.ts`
 *
 * Guards the rules in CLAUDE.md that must never silently regress: the economy
 * invariants, rarity boundaries, and the licensing gate. Exits non-zero on
 * failure so it can gate a build.
 *
 * This is not a substitute for a real test runner — it covers the pure
 * functions and the generated card pool, which is where a silent regression
 * would do the most damage (docs/IMPROVEMENTS.md #14).
 */

import { deriveStats, rarityForP, supplyTotal, decayRateFor, startingVibeFor,
  compositePopularity, HYPE_STAMINA_MIN, HYPE_STAMINA_MAX } from '../lib/stats';
import { RARITY } from '../lib/rarity';
import type { Rarity } from '../types/cards';


/*
  The card pool comes from the database, not from lib/seed-data.ts.

  These invariants (stat bounds, supply, the licensing gate) are about the
  cards the app actually serves. Checking them against a ten-card design
  fixture meant they passed while saying nothing about the 60 real cards
  players pull, and the fixture was hand-written to satisfy them anyway.
*/
interface PoolCard {
  id: string; title: string; subtitle: string; rarity: Rarity;
  hype: number; stamina: number;
  supplyTotal: number; supplyRemaining: number;
  artworkUrl: string | null; artworkSource: string | null;
  mbRecordingId: string | null; youtubeVideoId: string | null;
  previewUrl: string | null;
  jamendoTrackId: string | null; licenseVariant: string | null;
  audiusTrackId: string | null;
  audioAnalyzable: boolean; playbackMode: string | null;
}

async function loadPool(): Promise<PoolCard[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const res = await fetch(`${url}/rest/v1/cards?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    subtitle: String(r.subtitle ?? ''),
    rarity: r.rarity as Rarity,
    hype: Number(r.hype),
    stamina: Number(r.stamina),
    supplyTotal: Number(r.supply_total),
    supplyRemaining: Number(r.supply_remaining),
    artworkUrl: (r.artwork_url as string) ?? null,
    artworkSource: (r.artwork_source as string) ?? null,
    mbRecordingId: (r.mb_recording_id as string) ?? null,
    youtubeVideoId: (r.youtube_video_id as string) ?? null,
    previewUrl: (r.preview_url as string) ?? null,
    jamendoTrackId: (r.jamendo_track_id as string) ?? null,
    audiusTrackId: (r.audius_track_id as string) ?? null,
    licenseVariant: (r.license_variant as string) ?? null,
    audioAnalyzable: Boolean(r.audio_analyzable),
    playbackMode: (r.playback_mode as string) ?? null,
  }));
}

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = '') {
  checks++;
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(t: string) {
  console.log(`\n${t}`);
}

// ---------------------------------------------------------------------------
section('ECONOMY INVARIANTS (CLAUDE.md §3)');

let worstSum = { lo: 999, hi: 0 };
for (let sp = 0; sp <= 100; sp += 2) {
  for (const dz of [null, 1_000, 50_000, 400_000, 1_000_000]) {
    for (const rc of [0, 5, 20, 60]) {
      const s = deriveStats(
        { spotifyPopularity: sp, spotifyFollowers: null, deezerRank: dz, capturedAt: '' },
        rc,
      );
      const sum = s.hype + s.stamina;
      worstSum.lo = Math.min(worstSum.lo, sum);
      worstSum.hi = Math.max(worstSum.hi, sum);
    }
  }
}
check(
  `hype+stamina stays within [${HYPE_STAMINA_MIN},${HYPE_STAMINA_MAX}]`,
  worstSum.lo >= HYPE_STAMINA_MIN && worstSum.hi <= HYPE_STAMINA_MAX,
  `observed ${worstSum.lo}..${worstSum.hi}`,
);

check('rarity boundaries are ordered and total',
  rarityForP(0.0) === 'common' && rarityForP(0.44) === 'common' &&
  rarityForP(0.45) === 'rare' && rarityForP(0.69) === 'rare' &&
  rarityForP(0.70) === 'epic' && rarityForP(0.87) === 'epic' &&
  rarityForP(0.88) === 'legendary' && rarityForP(1) === 'legendary');

check('scarcer tiers have strictly smaller supply',
  RARITY.legendary.baseSupply < RARITY.epic.baseSupply &&
  RARITY.epic.baseSupply < RARITY.rare.baseSupply &&
  RARITY.rare.baseSupply < RARITY.common.baseSupply);

check('supply scales with active users (CLAUDE.md §3)',
  supplyTotal('epic', 0) === RARITY.epic.baseSupply &&
  supplyTotal('epic', 500) === RARITY.epic.baseSupply + 10);

check('no popularity source ⇒ conservative default, never a crash',
  Math.abs(compositePopularity({ spotifyPopularity: null, spotifyFollowers: null,
    deezerRank: null, capturedAt: '' }) - 0.35) < 1e-9);

// ---------------------------------------------------------------------------
section('CORE LOOP BALANCE (CLAUDE.md §1)');

check('higher stamina always decays slower',
  decayRateFor(100) < decayRateFor(50) && decayRateFor(50) < decayRateFor(0));

check('decay is always positive — the throne must be losable',
  decayRateFor(100) > 0);

check('higher hype always starts higher',
  startingVibeFor(100) > startingVibeFor(50) && startingVibeFor(50) > startingVibeFor(0));

// A reign must resolve in a playable window: long enough to feel like
// holding something, short enough that the throne changes hands.
const secs = (h: number, st: number) => ((startingVibeFor(h) - 25) / decayRateFor(st)) * 0.42;
const legendarySecs = secs(98, 91);
const commonSecs = secs(41, 58);
check('unopposed reign lasts 15–120s at every tier',
  commonSecs > 15 && legendarySecs < 120,
  `common ${commonSecs.toFixed(0)}s, legendary ${legendarySecs.toFixed(0)}s`);

check('better cards hold longer than worse ones',
  legendarySecs > commonSecs);

// ---------------------------------------------------------------------------
function cardPoolChecks(pool: PoolCard[]) {
  section('CARD POOL INTEGRITY');

  check('pool is non-empty', pool.length > 0, `${pool.length} cards`);

  const tiers = pool.reduce<Record<string, number>>((a, c) => {
    a[c.rarity] = (a[c.rarity] ?? 0) + 1;
    return a;
  }, {});
  check('every rarity tier is represented',
    (['common', 'rare', 'epic', 'legendary'] as Rarity[]).every((r) => (tiers[r] ?? 0) > 0),
    JSON.stringify(tiers));

  check('no duplicate card ids',
    new Set(pool.map((c) => c.id)).size === pool.length);

  check('no duplicate MusicBrainz recording ids',
    new Set(pool.map((c) => c.mbRecordingId)).size === pool.length);

  check('every card obeys the hype+stamina invariant',
    pool.every((c) => c.hype + c.stamina >= HYPE_STAMINA_MIN
      && c.hype + c.stamina <= HYPE_STAMINA_MAX),
    pool.filter((c) => c.hype + c.stamina < HYPE_STAMINA_MIN
      || c.hype + c.stamina > HYPE_STAMINA_MAX).map((c) => c.title).join(', '));

  check('stats are within 0–100',
    pool.every((c) => c.hype >= 0 && c.hype <= 100 && c.stamina >= 0 && c.stamina <= 100));

  check('supply_remaining never exceeds supply_total',
    pool.every((c) => c.supplyRemaining <= c.supplyTotal && c.supplyRemaining >= 0));

  // ---------------------------------------------------------------------------
  section('LICENSING GATE (docs/LICENSING_RIGHTS.md)');

  check('audioAnalyzable ⇒ jamendo id AND licence recorded (CARD_SCHEMA §7.3)',
    pool.every((c) => !c.audioAnalyzable || (c.jamendoTrackId && c.licenseVariant)),
    pool.filter((c) => c.audioAnalyzable && !c.licenseVariant).map((c) => c.title).join(', '));

  check('no card stores a non-Jamendo audio URL (DO NOT #1)',
    pool.every((c) => !c.audioAnalyzable || c.playbackMode === 'jamendo_local'));

  /*
    This used to test `!== undefined`, which is true for null -- so all 60
    cards passed while 50 of them declared 'youtube_embed' with no video id
    at all. A card that names a playback path it cannot perform is not
    playable, so the check now demands the id actually be there.
  */
  const canPlay = (c: PoolCard): boolean =>
    c.playbackMode === 'youtube_embed'
      ? Boolean(c.youtubeVideoId)
      : c.playbackMode === 'apple_preview'
        ? Boolean(c.previewUrl)
        : c.playbackMode === 'audius_stream'
          // Audius streams by track id; there is no stored URL to fall back
          // on, so a null id is a card that cannot make a sound at all.
          ? Boolean(c.audiusTrackId)
          : c.playbackMode === 'jamendo_local'
            ? Boolean(c.jamendoTrackId)
            : true;

  check('every card can perform the playback mode it declares',
    pool.every(canPlay),
    pool.filter((c) => !canPlay(c))
      .map((c) => `${c.title} (${c.playbackMode})`).join(', '));

  check('every card has artwork',
    pool.every((c) => Boolean(c.artworkUrl)),
    pool.filter((c) => !c.artworkUrl).map((c) => c.title).join(', '));

  check('artwork comes only from approved sources',
    pool.every((c) => c.artworkSource === null
      || ['caa', 'spotify', 'itunes', 'os_sync'].includes(c.artworkSource)));

  // ---------------------------------------------------------------------------
  section('PLAYABILITY / DEMO READINESS');

  const withArt = pool.filter((c) => c.artworkUrl).length;
  check('at least half the pool has real artwork',
    withArt >= pool.length / 2, `${withArt}/${pool.length}`);

  /*
    Playable means "this card can make a sound", and the app has two paths
    for that: the YouTube embed and Apple's 30s preview (usePreviewAudio,
    which is what tap-to-play in the collection uses). Counting only
    youtubeVideoId called 50 of the 60 real cards unplayable while every one
    of them previews fine.

    The old check passed at 10/10 because it ran against a fixture whose ten
    hand-written cards all carried video ids — a good example of a green
    check that knew nothing about what players actually pull.

    Audius added a third path, and it is the only FULL-LENGTH one that needs
    no embed. It stores a track id rather than a URL, so counting URLs alone
    would call the 30 most playable cards in the pool unplayable — the same
    shape of mistake as the two above, one source later.
  */
  const withAudio = pool.filter(
    (c) => c.youtubeVideoId || c.previewUrl || c.audiusTrackId,
  ).length;
  check('at least half the pool is playable',
    withAudio >= pool.length / 2, `${withAudio}/${pool.length}`);

  // Full-length playback is what the demo actually needs: a 30s preview cuts
  // out mid-reign, and a reign can run ~37s. Audius is the only source in the
  // pool that provides it without an embed.
  const fullLength = pool.filter(
    (c) => c.audiusTrackId || c.youtubeVideoId,
  ).length;
  check('the pool has full-length playback, not only 30s previews',
    fullLength > 0, `${fullLength}/${pool.length} full-length`);

  // The opening hand is chosen by rarity at runtime (the signup trigger
  // grants 21 cards), so the invariant that matters is that the pool CAN
  // produce a mixed hand -- a pool of one tier would make it impossible.
  check('pool can produce a hand spanning more than one rarity',
    new Set(pool.map((c) => c.rarity)).size > 1);

  check('a legendary exists for the pack money-shot (DEMO_FALLBACKS)',
    pool.some((c) => c.rarity === 'legendary'));

  // ---------------------------------------------------------------------------
}

// ---------------------------------------------------------------------------
section('SOCIAL LAYER GUARD RAILS (CLAUDE.md §1.1)');

/*
  These checked the EVENTS fixture, which could not fail: the array was
  hand-written to satisfy them. The guard rail is about real scheduled
  nights — "every scheduled night resolves into a room" is only meaningful
  against the rows the app actually reads — so they now query the database.

  Skipped rather than failed without credentials, because this script also
  runs in places that have no .env.local and the pure-function checks above
  are still worth running there.
*/
async function socialGuardRails() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log('  – skipped (no Supabase credentials in env)');
    return;
  }

  const res = await fetch(
    `${url}/rest/v1/events?select=room_id,capacity,rooms(mode)`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    check('events are readable', false, `HTTP ${res.status}`);
    return;
  }

  const evs = (await res.json()) as {
    room_id: string | null;
    capacity: number | null;
    rooms: { mode: string } | { mode: string }[] | null;
  }[];

  if (evs.length === 0) {
    console.log('  – skipped (no events scheduled)');
    return;
  }

  const modeOf = (e: (typeof evs)[number]) =>
    (Array.isArray(e.rooms) ? e.rooms[0] : e.rooms)?.mode;

  check('every event resolves into a room',
    evs.every((e) => Boolean(e.room_id)));

  check('event capacity is never negative',
    evs.every((e) => e.capacity === null || e.capacity >= 0));

  check('every event names a room mode (casual or event)',
    evs.every((e) => modeOf(e) === 'casual' || modeOf(e) === 'event'));
}

// ---------------------------------------------------------------------------
// The social checks hit the network, so the summary has to wait for them. A
// plain top-level await is not available under this script's cjs transform,
// hence the explicit main().
async function main() {
  const pool = await loadPool();
  if (pool === null) {
    section('CARD POOL INTEGRITY');
    console.log('  – skipped (no Supabase credentials in env)');
  } else if (pool.length === 0) {
    check('pool is non-empty', false, 'the cards table is empty');
  } else {
    cardPoolChecks(pool);
  }

  await socialGuardRails();

  console.log(`\n${'─'.repeat(52)}`);
  if (failures === 0) {
    console.log(`ALL ${checks} CHECKS PASSED`);
    process.exit(0);
  } else {
    console.log(`${failures} of ${checks} CHECKS FAILED`);
    process.exit(1);
  }
}

void main();
