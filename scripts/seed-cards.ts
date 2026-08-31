/**
 * Card seeding pipeline — implements docs/DATA_POPULATION.md.
 *
 *   npx tsx scripts/seed-cards.ts            # full run
 *   npx tsx scripts/seed-cards.ts --limit 5  # quick test
 *   npx tsx scripts/seed-cards.ts --out lib/generated-cards.ts
 *
 * Sources, in order of legal safety (docs/LICENSING_RIGHTS.md):
 *   MusicBrainz    CC0 — canonical identity. Anchors everything.
 *   Cover Art Archive — real album artwork.
 *   Deezer         `rank` popularity. NOTE: free tier is non-commercial (§0.3).
 *   Spotify        OPTIONAL. Dev Mode caps at 5 users (§0.1), so never required.
 *
 * Artist photos are NOT fetched: blocked pending rights review (§3.8).
 * Album art only.
 *
 * Results are cached per-MBID so a failed run resumes instead of re-hammering
 * rate-limited APIs.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { deriveStats, supplyTotal } from '../lib/stats';
import type { PopularitySnapshot, Rarity } from '../types/cards';

const CACHE_DIR = join(process.cwd(), 'seeds', '.cache');
const OUT_DEFAULT = join(process.cwd(), 'lib', 'generated-cards.ts');

/** MusicBrainz requires a descriptive UA with contact info; generic agents are refused. */
const UA = 'Beatz/0.1 (AuxWars; https://github.com/beatz) seed-pipeline';

/** MusicBrainz allows ~1 req/s. Exceeding it gets the IP blocked. */
const MB_DELAY_MS = 1100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SeedRow {
  mbRecordingId: string;
  title?: string;
  artist?: string;
  releaseGroupId?: string;
  /**
   * Curated fallback tier, used ONLY when every popularity source is
   * unreachable. Real popularity data always wins (CLAUDE.md §2 — rarity is
   * universal and derived, never hand-assigned).
   *
   * This exists because all three sources can be simultaneously unavailable:
   * Spotify caps Dev Mode at 5 users, Deezer's free tier is geo-restricted,
   * and ListenBrainz now requires an auth token. Without a hint every card
   * defaults to P=0.35 and the whole pool mints as common.
   */
  tierHint?: Rarity;
  /** Display language tag — shown on the card so a mixed pool reads clearly. */
  language?: string;
  /** Verified embeddable YouTube id — the licence-safe playback path (§2.7). */
  youtubeVideoId?: string;
  flavorText: string;
  demoCritical?: boolean;
}

/** Representative P for a hinted tier — the midpoint of each band. */
const TIER_HINT_P: Record<Rarity, number> = {
  common: 0.3,
  rare: 0.57,
  epic: 0.79,
  legendary: 0.93,
};

interface EnrichedCard {
  mbRecordingId: string;
  mbReleaseGroupId: string | null;
  title: string;
  artists: { mbArtistId: string; name: string; role: 'primary'; joinPhrase: string | null }[];
  artworkUrl: string | null;
  artworkSource: 'caa' | null;
  deezerRank: number | null;
  artistReleaseCount: number;
  hype: number;
  stamina: number;
  rarity: Rarity;
  needsReview: boolean;
  flavorText: string;
  language: string | null;
  youtubeVideoId: string | null;
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Stage 1 — MusicBrainz. CC0 core tables only (no annotations: those are CC BY-NC-SA). */
async function fetchMusicBrainz(mbid: string) {
  const url = `https://musicbrainz.org/ws/2/recording/${mbid}?inc=artist-credits+releases+release-groups&fmt=json`;
  const data = await fetchJson<any>(url);
  if (!data) return null;

  const artists = (data['artist-credit'] ?? []).map((ac: any) => ({
    mbArtistId: ac.artist?.id ?? '',
    name: ac.name ?? ac.artist?.name ?? 'Unknown',
    role: 'primary' as const,
    joinPhrase: ac.joinphrase || null,
  }));

  const releaseGroupId =
    data.releases?.[0]?.['release-group']?.id ?? null;

  return { title: data.title as string, artists, releaseGroupId };
}

/** Stage 2 — Deezer `rank`. No auth. Weak matches record null: wrong data is worse than none. */
async function fetchDeezerRank(title: string, artist: string): Promise<number | null> {
  const q = encodeURIComponent(`track:"${title}" artist:"${artist}"`);
  const data = await fetchJson<any>(`https://api.deezer.com/search?q=${q}&limit=1`);
  const hit = data?.data?.[0];
  if (!hit) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(hit.title) !== norm(title) && !norm(hit.title).includes(norm(title))) return null;

  return typeof hit.rank === 'number' ? hit.rank : null;
}

/** Stage 4 — artwork. CAA first: real covers, and the safest source (§2.2). */
async function fetchCoverArt(releaseGroupId: string | null): Promise<string | null> {
  if (!releaseGroupId) return null;
  const url = `https://coverartarchive.org/release-group/${releaseGroupId}/front-500`;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA } });
    return res.ok ? res.url : null;
  } catch {
    return null;
  }
}

async function artistReleaseCount(mbArtistId: string): Promise<number> {
  if (!mbArtistId) return 0;
  const data = await fetchJson<any>(
    `https://musicbrainz.org/ws/2/release-group?artist=${mbArtistId}&limit=1&fmt=json`,
  );
  return data?.['release-group-count'] ?? 0;
}

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const path = join(CACHE_DIR, `${key}.json`);
  if (existsSync(path)) {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  }
  const value = await fn();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
  return value;
}

async function enrich(row: SeedRow): Promise<EnrichedCard | null> {
  return cached(row.mbRecordingId, async () => {
    const mb = await fetchMusicBrainz(row.mbRecordingId);
    await sleep(MB_DELAY_MS);
    if (!mb) {
      console.warn(`  ✗ MusicBrainz miss: ${row.mbRecordingId}`);
      return null as any;
    }

    const primaryArtist = mb.artists[0]?.name ?? '';
    const [rank, artwork, releaseCount] = await Promise.all([
      fetchDeezerRank(mb.title, primaryArtist),
      fetchCoverArt(mb.releaseGroupId),
      artistReleaseCount(mb.artists[0]?.mbArtistId ?? ''),
    ]);
    await sleep(MB_DELAY_MS);

    const snap: PopularitySnapshot = {
      spotifyPopularity: null, // Spotify is optional; see §0.1
      spotifyFollowers: null,
      deezerRank: rank,
      capturedAt: new Date().toISOString(),
    };

    let stats = deriveStats(snap, releaseCount);

    // Real popularity always wins. The hint applies only when no source
    // resolved — otherwise the pool would mint entirely common and the
    // rarity ladder would be untestable.
    if (stats.needsReview && row.tierHint) {
      const P = TIER_HINT_P[row.tierHint];
      stats = deriveStats(
        { ...snap, deezerRank: Math.round(Math.pow(P, 1 / 0.38) * 1_000_000) },
        releaseCount,
      );
      stats.needsReview = true; // still flagged: this is curated, not measured
    }

    console.log(
      `  ✓ ${mb.title} — ${primaryArtist} · ${stats.rarity.toUpperCase()} ` +
        `(h${stats.hype}/s${stats.stamina})${artwork ? ' +art' : ''}${stats.needsReview ? ' ⚠review' : ''}`,
    );

    return {
      mbRecordingId: row.mbRecordingId,
      mbReleaseGroupId: mb.releaseGroupId,
      title: mb.title,
      artists: mb.artists,
      artworkUrl: artwork,
      artworkSource: artwork ? ('caa' as const) : null,
      deezerRank: rank,
      artistReleaseCount: releaseCount,
      hype: stats.hype,
      stamina: stats.stamina,
      rarity: stats.rarity,
      needsReview: stats.needsReview,
      flavorText: row.flavorText,
      language: row.language ?? null,
      youtubeVideoId: row.youtubeVideoId ?? null,
    };
  });
}

function emit(cards: EnrichedCard[]): string {
  const rows = cards.map((c, i) => {
    const isCollab = c.artists.length > 1;
    const subtitle = isCollab
      ? c.artists.map((a) => a.name).join(' × ').toUpperCase()
      : (c.artists[0]?.name ?? 'UNKNOWN').toUpperCase();

    return `  {
    id: 'gen-${String(i).padStart(3, '0')}',
    kind: 'song',
    title: ${JSON.stringify(c.title)},
    subtitle: ${JSON.stringify(subtitle)},
    artworkUrl: ${JSON.stringify(c.artworkUrl)},
    artworkSource: ${JSON.stringify(c.artworkSource)},
    rarity: '${c.rarity}',
    primaryStat: ${c.hype},
    secondaryStat: ${c.stamina},
    flavorText: ${JSON.stringify(c.flavorText)},
    language: ${JSON.stringify(c.language)},
    createdAt: '${new Date().toISOString()}',
    mbRecordingId: ${JSON.stringify(c.mbRecordingId)},
    mbReleaseGroupId: ${JSON.stringify(c.mbReleaseGroupId)},
    isrc: null,
    spotifyTrackId: null,
    deezerTrackId: null,
    youtubeVideoId: ${JSON.stringify(c.youtubeVideoId)},
    jamendoTrackId: null,
    artists: ${JSON.stringify(c.artists)},
    isCollab: ${isCollab},
    hype: ${c.hype},
    stamina: ${c.stamina},
    popularitySnapshot: { spotifyPopularity: null, spotifyFollowers: null, deezerRank: ${c.deezerRank}, capturedAt: '${new Date().toISOString()}' },
    serialNumber: ${i + 1},
    supplyTotal: ${supplyTotal(c.rarity, 0)},
    supplyRemaining: ${supplyTotal(c.rarity, 0)},
    playbackMode: 'youtube_embed',
    audioAnalyzable: false,
    licenseVariant: null,
    attributionText: null,
    licenseUrl: null,
  }`;
  });

  return `/**
 * GENERATED by scripts/seed-cards.ts — do not edit by hand.
 * Generated ${new Date().toISOString()}
 *
 * Artwork: Cover Art Archive. Metadata: MusicBrainz (CC0).
 * Popularity: Deezer \`rank\`.
 * No artist photographs — blocked per docs/LICENSING_RIGHTS.md §3.8.
 */

import type { SongCard } from '@/types/cards';

export const GENERATED_CARDS: SongCard[] = [
${rows.join(',\n')},
];
`;
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const outArg = args.indexOf('--out');
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
  const outPath = outArg >= 0 ? args[outArg + 1] : OUT_DEFAULT;

  const seedPath = join(process.cwd(), 'seeds', 'cards.seed.json');
  if (!existsSync(seedPath)) {
    console.error(`No seed list at ${seedPath}. See docs/DATA_POPULATION.md §1.2.`);
    process.exit(1);
  }

  const rows: SeedRow[] = JSON.parse(await readFile(seedPath, 'utf8'));
  const slice = rows.slice(0, limit);

  console.log(`Seeding ${slice.length} cards (MusicBrainz @ ~1 req/s — this takes a while)\n`);

  const cards: EnrichedCard[] = [];
  for (const row of slice) {
    const card = await enrich(row);
    if (card) cards.push(card);
  }

  if (cards.length === 0) {
    console.error('\nNo cards enriched. Check network access and the seed MBIDs.');
    process.exit(1);
  }

  await writeFile(outPath, emit(cards));

  const byTier = cards.reduce<Record<string, number>>((a, c) => {
    a[c.rarity] = (a[c.rarity] ?? 0) + 1;
    return a;
  }, {});

  console.log(`\nWrote ${cards.length} cards → ${outPath}`);
  console.log('Tier distribution:', byTier);
  console.log(`With artwork: ${cards.filter((c) => c.artworkUrl).length}/${cards.length}`);
  console.log(`Needs review: ${cards.filter((c) => c.needsReview).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
