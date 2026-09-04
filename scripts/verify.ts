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
import { GENERATED_CARDS } from '../lib/generated-cards';
import { buildChart } from '../lib/domain/chart';
import { ALL_CARDS, STARTING_HAND } from '../lib/seed-data';
import type { Rarity } from '../types/cards';

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
section('CARD POOL INTEGRITY');

check('pool is non-empty', ALL_CARDS.length > 0, `${ALL_CARDS.length} cards`);

const tiers = ALL_CARDS.reduce<Record<string, number>>((a, c) => {
  a[c.rarity] = (a[c.rarity] ?? 0) + 1;
  return a;
}, {});
check('every rarity tier is represented',
  (['common', 'rare', 'epic', 'legendary'] as Rarity[]).every((r) => (tiers[r] ?? 0) > 0),
  JSON.stringify(tiers));

check('no duplicate card ids',
  new Set(ALL_CARDS.map((c) => c.id)).size === ALL_CARDS.length);

check('no duplicate MusicBrainz recording ids',
  new Set(ALL_CARDS.map((c) => c.mbRecordingId)).size === ALL_CARDS.length);

check('every card obeys the hype+stamina invariant',
  ALL_CARDS.every((c) => c.hype + c.stamina >= HYPE_STAMINA_MIN
    && c.hype + c.stamina <= HYPE_STAMINA_MAX),
  ALL_CARDS.filter((c) => c.hype + c.stamina < HYPE_STAMINA_MIN
    || c.hype + c.stamina > HYPE_STAMINA_MAX).map((c) => c.title).join(', '));

check('stats are within 0–100',
  ALL_CARDS.every((c) => c.hype >= 0 && c.hype <= 100 && c.stamina >= 0 && c.stamina <= 100));

check('supply_remaining never exceeds supply_total',
  ALL_CARDS.every((c) => c.supplyRemaining <= c.supplyTotal && c.supplyRemaining >= 0));

// ---------------------------------------------------------------------------
section('LICENSING GATE (docs/LICENSING_RIGHTS.md)');

check('audioAnalyzable ⇒ jamendo id AND licence recorded (CARD_SCHEMA §7.3)',
  ALL_CARDS.every((c) => !c.audioAnalyzable || (c.jamendoTrackId && c.licenseVariant)),
  ALL_CARDS.filter((c) => c.audioAnalyzable && !c.licenseVariant).map((c) => c.title).join(', '));

check('no card stores a non-Jamendo audio URL (DO NOT #1)',
  ALL_CARDS.every((c) => !c.audioAnalyzable || c.playbackMode === 'jamendo_local'));

check('youtube_embed cards carry a video id, or fall back cleanly',
  ALL_CARDS.every((c) => c.playbackMode !== 'youtube_embed' || c.youtubeVideoId !== undefined));

check('artwork comes only from approved sources',
  ALL_CARDS.every((c) => c.artworkSource === null
    || ['caa', 'spotify', 'itunes', 'os_sync'].includes(c.artworkSource)));

// ---------------------------------------------------------------------------
section('PLAYABILITY / DEMO READINESS');

const withArt = ALL_CARDS.filter((c) => c.artworkUrl).length;
check('at least half the pool has real artwork',
  withArt >= ALL_CARDS.length / 2, `${withArt}/${ALL_CARDS.length}`);

const withAudio = ALL_CARDS.filter((c) => c.youtubeVideoId).length;
check('at least half the pool is playable',
  withAudio >= ALL_CARDS.length / 2, `${withAudio}/${ALL_CARDS.length}`);

check('opening hand spans more than one rarity',
  new Set(STARTING_HAND.map((c) => c.rarity)).size > 1);

check('a legendary exists for the pack money-shot (DEMO_FALLBACKS)',
  ALL_CARDS.some((c) => c.rarity === 'legendary'));

// The marketplace listings this used to check were invented offer amounts
// on a screen with no bids table behind it. The chart now ranks by real
// scarcity instead, so the invariant worth holding is that the ranking is
// monotonic in scarcity — a less-claimed card must never outrank a
// more-claimed one.
check('world chart ranks by descending scarcity',
  (() => {
    const chart = buildChart(ALL_CARDS.map((c) => ({
      cardId: c.id, title: c.title, subtitle: c.subtitle, rarity: c.rarity,
      artworkUrl: c.artworkUrl,
      supplyTotal: c.supplyTotal, supplyRemaining: c.supplyRemaining,
    })));
    return chart.every((e, i) => i === 0 || chart[i - 1].scarcity >= e.scarcity);
  })());

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
