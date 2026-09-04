/**
 * Build Audius-sourced cards — the only full-length playback path in the pool.
 *
 *   node scripts/seed-audius.mjs
 *   node scripts/seed-audius.mjs --take 30
 *
 * Why Audius (docs/LICENSING_RIGHTS.md — new source, same rules):
 *   Every other source in this pipeline gives us 30 seconds or an embed.
 *   Apple's preview is 30s; YouTube is a full track but only 10 of the 60
 *   chart cards resolved a video id. Audius artists opt in to third-party
 *   API access under its Open Music License, the API is public and keyless,
 *   and `/v1/tracks/<id>/stream` serves the whole track.
 *
 * Nothing here downloads or stores audio. We store the Audius track id and
 * stream through their API at play time, exactly as we do with Apple's
 * preview URL. No file ever lands on our disk or in our bucket.
 *
 * Rarity is NOT hand-assigned. `play_count` and `favorite_count` are real
 * listening data; they are folded into the same composite P ∈ [0,1] the rest
 * of the pipeline uses and run through lib/stats.ts's `deriveStats` — the
 * same function, not a parallel ladder (CLAUDE.md §2).
 */

import { writeFile, mkdir } from 'node:fs/promises';

const HOST = 'https://api.audius.co';
const APP = 'Beatz';
const UA = 'Beatz/0.1 (AuxWars)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Audius is creator-uploaded, so there is no chart to walk — a search sweep is
 * the only way in. These ten queries were the ones that actually returned
 * Indian-language music rather than lo-fi beats tagged "desi".
 */
const QUERIES = [
  ['bollywood', 'hindi'],
  ['hindi', 'hindi'],
  ['arijit', 'hindi'],
  ['desi', 'hindi'],
  ['punjabi', 'punjabi'],
  ['bhangra', 'punjabi'],
  ['tamil', 'tamil'],
  ['telugu', 'telugu'],
  ['indian classical', 'hindi'],
  ['india', 'hindi'],
];

/** A card slot is worth more than a clip or an hour-long DJ set. */
const MIN_DURATION_S = 60;
const MAX_DURATION_S = 420;

const FLAVOUR = [
  'Nobody knew it. Everybody moved anyway.',
  'Someone found this at 2am and never shut up about it.',
  'Full length. No fade-out. No mercy.',
  'The room asked who this was. Twice.',
  'Built for the part of the night nobody remembers.',
  'Uploaded by someone who meant it.',
  'Held the floor without a single familiar bar.',
  'A deep cut that refused to stay deep.',
  'Played it on a hunch. The hunch was right.',
  'Three minutes of the room agreeing with itself.',
  'Started as a dare. Ended as a reign.',
  'No chart put this here. The room did.',
];

async function json(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** One search sweep. Audius returns ~10 per query; there is no paging worth adding. */
async function search(query) {
  const j = await json(
    `${HOST}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${APP}`,
  );
  return j?.data ?? [];
}

const streamUrl = (id) => `${HOST}/v1/tracks/${id}/stream?app_name=${APP}`;

/**
 * A card that cannot play is worse than no card, and Audius content nodes do
 * go down independently of the discovery API — a track can be listed, marked
 * streamable, and still 404 at the node holding it. So every accepted track
 * has its stream actually resolved, not merely assumed.
 *
 * A ranged GET rather than HEAD: the stream endpoint 302s to a content node,
 * and some nodes answer HEAD with 405 while serving GET fine.
 */
async function streamResolves(id) {
  try {
    const r = await fetch(streamUrl(id), {
      headers: { 'User-Agent': UA, Range: 'bytes=0-1023' },
      redirect: 'follow',
    });
    if (!r.ok) return false;
    const type = r.headers.get('content-type') ?? '';
    // Drain so the socket is released; we want the headers, not the audio.
    await r.arrayBuffer().catch(() => {});
    return type.startsWith('audio/');
  } catch {
    return false;
  }
}

/**
 * Audius popularity → the same P ∈ [0,1] the rest of the pipeline speaks.
 *
 * `play_count` is long-tailed exactly the way Deezer's `rank` is (measured over
 * the 79 usable tracks: min 7, median 789, p90 9.2k, max 23.9k), so it gets the
 * same treatment lib/stats.ts gives Deezer — a power curve, not log10, because
 * log saturates far too early and would mint legendaries out of the midfield.
 *
 * Favourites are folded in at a lower weight for the same reason Spotify
 * outranks Deezer upstream: a play can be a scroll-past, a favourite is a
 * deliberate act, but there are two orders of magnitude fewer of them so on
 * their own they are noisy.
 *
 * The scale constants are the observed ceiling of this catalog, not the
 * ceiling of Audius as a whole. That is deliberate: rarity has to be
 * meaningful *within the pool a player pulls from*, and a global normaliser
 * would flatten every one of these tracks to common.
 */
const PLAY_CEILING = 25_000;
const FAV_CEILING = 550;

export function audiusPopularity(playCount, favoriteCount) {
  const plays = Math.min(1, Math.pow(Math.max(playCount ?? 0, 0) / PLAY_CEILING, 0.38));
  const favs = Math.min(1, Math.pow(Math.max(favoriteCount ?? 0, 0) / FAV_CEILING, 0.38));
  return 0.65 * plays + 0.35 * favs;
}

/**
 * lib/stats.ts is TypeScript and this is a plain .mjs script (matching
 * fetch-charts.mjs), so P is handed to the shared pipeline the same way
 * seed-cards.ts hands over a curated tier: as a deezerRank that inverts to
 * exactly this P. `deriveStats` then computes hype, stamina and rarity — one
 * ladder, one set of functions, no second implementation to drift.
 */
const pAsDeezerRank = (P) => Math.round(Math.pow(Math.min(P, 1), 1 / 0.38) * 1_000_000);

async function main() {
  const args = process.argv.slice(2);
  const takeArg = args.indexOf('--take');
  const take = takeArg >= 0 ? Number(args[takeArg + 1]) : 30;

  console.log(`Collecting from Audius (${QUERIES.length} queries)\n`);

  /** @type {Map<string, any>} */
  const seen = new Map();
  for (const [query, language] of QUERIES) {
    const rows = await search(query);
    let kept = 0;
    for (const t of rows) {
      if (!t?.id || seen.has(t.id)) continue;
      if (t.is_streamable === false) continue;
      if (!(t.duration >= MIN_DURATION_S && t.duration <= MAX_DURATION_S)) continue;
      const artwork = t.artwork?.['480x480'];
      if (!artwork) continue;

      seen.set(t.id, {
        audiusTrackId: t.id,
        title: t.title,
        artist: t.user?.name ?? 'Unknown',
        artworkUrl: artwork,
        duration: t.duration,
        genre: t.genre ?? null,
        playCount: t.play_count ?? 0,
        favoriteCount: t.favorite_count ?? 0,
        language,
      });
      kept++;
    }
    console.log(`  ${query.padEnd(18)} ${rows.length} results, ${kept} usable and new`);
    await sleep(150);
  }

  const candidates = [...seen.values()];
  console.log(`\n${candidates.length} unique usable candidates. Verifying streams\n`);

  // Most-played first, so if verification thins the list we keep the tracks
  // most likely to land in a demo hand.
  candidates.sort((a, b) => b.playCount - a.playCount);

  const verified = [];
  let dead = 0;
  for (const c of candidates) {
    if (verified.length >= take) break;
    if (await streamResolves(c.audiusTrackId)) {
      verified.push(c);
    } else {
      dead++;
      console.log(`  ✗ stream did not resolve: ${c.title}`);
    }
    await sleep(120);
  }

  if (verified.length === 0) {
    console.error('\nNo Audius track streamed. Check network access.');
    process.exit(1);
  }

  const out = verified.map((c, i) => {
    const P = audiusPopularity(c.playCount, c.favoriteCount);
    return {
      // Namespaced source key, matching the `itunes:<id>` rows fetch-charts.mjs
      // already writes. An Audius track has no MusicBrainz id and inventing one
      // would poison a column other code trusts as canonical identity.
      mbRecordingId: `audius:${c.audiusTrackId}`,
      audiusTrackId: c.audiusTrackId,
      title: c.title,
      artist: c.artist,
      language: c.language,
      genre: c.genre,
      durationSeconds: c.duration,
      artworkUrl: c.artworkUrl,
      streamUrl: streamUrl(c.audiusTrackId),
      playCount: c.playCount,
      favoriteCount: c.favoriteCount,
      popularityP: Number(P.toFixed(4)),
      // Consumed by the push step, which runs P through lib/stats.ts.
      deezerRankEquivalent: pAsDeezerRank(P),
      flavorText: FLAVOUR[i % FLAVOUR.length],
    };
  });

  await mkdir('seeds', { recursive: true });
  await writeFile('seeds/audius.raw.json', JSON.stringify(out, null, 2));

  const byLang = out.reduce((a, r) => ((a[r.language] = (a[r.language] ?? 0) + 1), a), {});
  console.log(`\nWrote ${out.length} tracks -> seeds/audius.raw.json`);
  console.log(`streams verified: ${out.length}, rejected: ${dead}`);
  console.log('languages:', byLang);
  console.log('every track has artwork + a resolved full-length stream.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
