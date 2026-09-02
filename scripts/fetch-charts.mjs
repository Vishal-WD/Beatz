/**
 * Build the card pool from real "top listened" charts plus named artists.
 *
 *   node scripts/fetch-charts.mjs
 *
 * Sources — both Apple, both keyless:
 *   1. rss.applemarketingtools.com — the most-played feed per country. This is
 *      genuinely what is being listened to now, which is what makes chart rank
 *      a legitimate rarity input rather than a hand-assigned tier.
 *   2. itunes.apple.com/search — top songs for a set of named artists, so the
 *      pool contains the artists we want on screen and not only this week's hits.
 *
 * MusicBrainz is deliberately NOT used here. It rate-limits to 1 req/s, it
 * rejected ~75% of chart tracks (Indian film titles carry `(From "Movie")`
 * suffixes and its artist strings differ from Apple's credits), and it blocked
 * this IP mid-run. iTunes `trackId` is a stable unique key, which is all the
 * schema needs. The hand-curated cards in cards.seed.json keep their real MBIDs.
 *
 * Nothing here downloads or stores audio. `previewUrl` points at Apple's own
 * 30-second stream; full tracks play through YouTube's embed. Artwork is used
 * unmodified. See docs/LICENSING_RIGHTS.md §2.5.
 */

import { writeFile } from 'node:fs/promises';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHARTS = [
  { cc: 'in', label: 'india', take: 25, language: 'hindi' },
  { cc: 'us', label: 'usa', take: 15, language: 'english' },
];

/** Artists we want represented regardless of what is charting this week. */
const ARTISTS = [
  ['Anirudh Ravichander', 'tamil'],
  ['Yuvan Shankar Raja', 'tamil'],
  ['A R Rahman', 'tamil'],
  ['Ilaiyaraaja', 'tamil'],
  ['Sid Sriram', 'tamil'],
  ['Arijit Singh', 'hindi'],
  ['Pritam', 'hindi'],
  ['Shreya Ghoshal', 'hindi'],
  ['Badshah', 'hindi'],
  ['Diljit Dosanjh', 'hindi'],
  ['Devi Sri Prasad', 'telugu'],
  ['Thaman S', 'telugu'],
  ['Sushin Shyam', 'malayalam'],
  ['The Weeknd', 'english'],
  ['Dua Lipa', 'english'],
  ['Sabrina Carpenter', 'english'],
  ['Bad Bunny', 'english'],
  ['Billie Eilish', 'english'],
];

const FLAVOUR = [
  'The room recognised it in four notes.',
  'Held the aux for two full reigns.',
  'Room went feral on the second drop.',
  'Nobody sat down for this one.',
  "Somebody's cousin queued this. It worked.",
  'Grew on everybody by the chorus.',
  'Cleared half the room. The half that stayed went feral.',
  'Two minutes in, the whole floor knew the steps.',
  'Never peaked. Never dipped either.',
  'Played it once. Learned a lesson.',
  'Three people claimed they discovered it.',
  'The floor filled before the first chorus.',
];

async function json(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Beatz/0.1 (AuxWars)' } });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

/** Apple's own most-played feed — the closest thing to "top listened" without a key. */
async function chartTracks({ cc, label, take, language }) {
  const j = await json(
    `https://rss.applemarketingtools.com/api/v2/${cc}/music/most-played/${take}/songs.json`,
  );
  const rows = j?.feed?.results ?? [];
  console.log(`  charts/${label.padEnd(6)} ${rows.length} tracks`);
  return rows.map((s, i) => ({
    sourceId: `itunes:${s.id}`,
    title: s.name,
    artist: s.artistName,
    artworkUrl: s.artworkUrl100?.replace(/100x100/, '600x600') ?? null,
    previewUrl: null, // the RSS feed omits it; filled by the lookup pass below
    chartRank: i + 1,
    language,
  }));
}

/** Top songs for one named artist. */
async function artistTracks(name, language, perArtist = 4) {
  const j = await json(
    `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=${perArtist * 4}`,
  );
  const seen = new Set();
  const out = [];
  for (const s of j?.results ?? []) {
    // iTunes returns remixes, live cuts and re-releases; one per base title.
    const key = s.trackName?.toLowerCase().replace(/\s*[([].*$/, '').trim();
    if (!key || seen.has(key) || !s.previewUrl) continue;
    seen.add(key);
    out.push({
      sourceId: `itunes:${s.trackId}`,
      title: s.trackName,
      artist: s.artistName,
      artworkUrl: s.artworkUrl100?.replace(/100x100/, '600x600') ?? null,
      previewUrl: s.previewUrl,
      chartRank: null,
      language,
    });
    if (out.length >= perArtist) break;
  }
  console.log(`  ${name.padEnd(22)} ${out.length} tracks`);
  return out;
}

/** The RSS feed has no preview URL, so look each chart entry up by id. */
async function fillPreview(row) {
  const id = row.sourceId.replace('itunes:', '');
  const j = await json(`https://itunes.apple.com/lookup?id=${id}&entity=song`);
  const hit = j?.results?.[0];
  if (hit?.previewUrl) {
    row.previewUrl = hit.previewUrl;
    if (hit.artworkUrl100) row.artworkUrl = hit.artworkUrl100.replace(/100x100/, '600x600');
  }
  return row;
}

/**
 * Chart position drives rarity, so scarcity tracks real popularity rather than
 * being hand-assigned (CLAUDE.md §2 — rarity is universal and derived).
 * Tracks that never charted default to rare, then get demoted if the tier is
 * over-full, which keeps the ladder shaped like a pyramid.
 */
function tierFor(chartRank) {
  if (chartRank === null) return null; // decided in the balancing pass
  if (chartRank <= 3) return 'legendary';
  if (chartRank <= 10) return 'epic';
  if (chartRank <= 25) return 'rare';
  return 'common';
}

async function main() {
  console.log('Collecting from Apple charts and named artists\n');

  const rows = [];
  for (const c of CHARTS) rows.push(...(await chartTracks(c)));
  for (const [name, lang] of ARTISTS) {
    rows.push(...(await artistTracks(name, lang)));
    await sleep(150);
  }

  // Dedupe on title+artist — a charting song is often also an artist's top song.
  const seen = new Set();
  const unique = rows.filter((r) => {
    const k = `${r.title}|${r.artist}`.toLowerCase().replace(/\s*[([].*?[)\]]/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log(`\n${unique.length} unique. Filling preview URLs for chart entries\n`);
  for (const r of unique) {
    if (!r.previewUrl && r.chartRank !== null) {
      await fillPreview(r);
      await sleep(120);
    }
  }

  // Keep only what is actually playable and showable — a card with no artwork
  // and no audio is not worth a slot.
  const usable = unique.filter((r) => r.previewUrl && r.artworkUrl);

  // Balance the ladder. Un-charted tracks fill the lower tiers so the pool is
  // pyramid-shaped rather than top-heavy.
  const quota = { legendary: 6, epic: 12, rare: 20, common: 999 };
  const count = { legendary: 0, epic: 0, rare: 0, common: 0 };
  const out = [];
  for (const r of usable) {
    let tier = tierFor(r.chartRank);
    if (tier === null) {
      tier = count.rare < quota.rare ? 'rare' : 'common';
    } else if (count[tier] >= quota[tier]) {
      tier = tier === 'legendary' ? 'epic' : tier === 'epic' ? 'rare' : 'common';
    }
    count[tier]++;
    out.push({
      mbRecordingId: r.sourceId,
      title: r.title,
      artist: r.artist,
      releaseGroupId: null,
      language: r.language,
      tierHint: tier,
      flavorText: FLAVOUR[out.length % FLAVOUR.length],
      demoCritical: r.chartRank !== null && r.chartRank <= 3,
      itunesArtworkUrl: r.artworkUrl,
      itunesPreviewUrl: r.previewUrl,
      chartRank: r.chartRank,
    });
  }

  await writeFile('seeds/charts.raw.json', JSON.stringify(out, null, 2));

  const byLang = out.reduce((a, r) => ((a[r.language] = (a[r.language] ?? 0) + 1), a), {});
  console.log(`\nWrote ${out.length} cards -> seeds/charts.raw.json`);
  console.log('tiers:    ', count);
  console.log('languages:', byLang);
  console.log('charting: ', out.filter((r) => r.chartRank !== null).length);
  console.log('every card has artwork + 30s preview.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
