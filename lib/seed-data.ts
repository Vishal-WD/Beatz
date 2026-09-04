/**
 * Seeded card pool for local play and demo.
 *
 * Titles, artists and stats come from the approved design
 * (design/AuxWars.dc.html) so the built app matches the mock exactly.
 *
 * NOTE: these are DESIGN FIXTURES, not minted production cards. The real pool
 * comes from `pnpm seed:cards` (docs/DATA_POPULATION.md), which derives stats
 * from live popularity data. Stats here are hand-set to match the mock.
 */

import type { SongCard, Rarity } from '@/types/cards';
import { RARITY } from './rarity';
import { GENERATED_CARDS } from './generated-cards';

interface SeedRow {
  title: string;
  artist: string;
  hype: number;
  stamina: number;
  rarity: Rarity;
  flavor: string;
  collabWith?: string;
}

const SEED_ROWS: SeedRow[] = [
  { title: 'Neon Teeth',        artist: 'VELVET STATIC', hype: 88, stamina: 79, rarity: 'epic',      flavor: 'Room went feral on the second drop.' },
  { title: 'Chrome Rodeo',      artist: 'TALL BOY WEST', hype: 67, stamina: 72, rarity: 'rare',      flavor: 'Held the aux for two full reigns.' },
  { title: 'Sirens at Dawn',    artist: 'KOSMIC HAZE',   hype: 98, stamina: 91, rarity: 'legendary', flavor: 'Nobody challenged. Nobody dared.' },
  { title: 'Basement Hum',      artist: 'LOW CEILING',   hype: 41, stamina: 58, rarity: 'common',    flavor: "Somebody's cousin queued this." },
  { title: 'Split the Crown',   artist: 'DUAL WIELD',    hype: 74, stamina: 66, rarity: 'rare',      flavor: 'Two hands on one cable.' },
  { title: 'Static Bloom',      artist: 'PAPER SIREN',   hype: 55, stamina: 63, rarity: 'common',    flavor: 'Grew on everybody by the chorus.' },
  { title: 'Gold Tooth Anthem', artist: 'BIG SUNDAY',    hype: 81, stamina: 70, rarity: 'epic',      flavor: 'Every single person knew the words.' },
  { title: 'Low Orbit',         artist: 'MOTH CLUB',     hype: 62, stamina: 88, rarity: 'rare',      flavor: 'Never peaked. Never dipped either.' },
  { title: 'Feral Encore',      artist: 'NIGHT MAYOR',   hype: 95, stamina: 52, rarity: 'legendary', flavor: 'Burned the room down in ninety seconds.' },
  { title: 'Hallway Echo',      artist: 'SIX FLOORS',    hype: 38, stamina: 49, rarity: 'common',    flavor: 'Played it once. Learned a lesson.' },
  { title: 'Velvet Riot',       artist: 'VELVET STATIC', hype: 77, stamina: 74, rarity: 'epic',      flavor: 'The encore nobody asked for but everyone needed.' },
  { title: 'Two Kings One Aux', artist: 'VELVET STATIC', hype: 93, stamina: 64, rarity: 'epic',      flavor: 'Split the crown, doubled the noise.', collabWith: 'KOSMIC HAZE' },
];

const iso = (offsetDays: number) =>
  new Date(Date.UTC(2026, 7, 31 - offsetDays)).toISOString();

function buildCard(row: SeedRow, i: number): SongCard {
  const isCollab = Boolean(row.collabWith);
  const supply = RARITY[row.rarity].baseSupply;

  return {
    id: `seed-${i.toString().padStart(3, '0')}`,
    kind: 'song',
    title: row.title,
    subtitle: isCollab ? `${row.artist} × ${row.collabWith}` : row.artist,
    artworkUrl: null, // frame-only placeholder — the design renders "COVER ART"
    artworkSource: null,
    rarity: row.rarity,
    primaryStat: row.hype,
    secondaryStat: row.stamina,
    flavorText: row.flavor,
    createdAt: iso(i),

    mbRecordingId: `seed-mb-${i.toString().padStart(3, '0')}`,
    mbReleaseGroupId: null,
    isrc: null,

    spotifyTrackId: null,
    deezerTrackId: null,
    youtubeVideoId: null,
    jamendoTrackId: null,

    artists: [
      { mbArtistId: `seed-artist-${row.artist}`, name: row.artist, role: 'primary', joinPhrase: isCollab ? ' × ' : null },
      ...(row.collabWith
        ? [{ mbArtistId: `seed-artist-${row.collabWith}`, name: row.collabWith, role: 'primary' as const, joinPhrase: null }]
        : []),
    ],
    isCollab,

    hype: row.hype,
    stamina: row.stamina,
    popularitySnapshot: {
      spotifyPopularity: null,
      spotifyFollowers: null,
      deezerRank: null,
      capturedAt: iso(i),
    },

    serialNumber: i + 1,
    supplyTotal: supply,
    supplyRemaining: supply - i * 3,

    // Seed fixtures have no licensed audio source, so nothing is analyzable.
    // audioAnalyzable must never be true without a Jamendo id + license
    // (CARD_SCHEMA.md invariant 3).
    playbackMode: 'youtube_embed',
    audioAnalyzable: false,
    licenseVariant: null,
    attributionText: null,
    licenseUrl: null,
  };
}

/**
 * Real cards (MusicBrainz identity + Cover Art Archive artwork) come first,
 * with the hand-authored design fixtures appended so the pool always has
 * enough breadth to fill a binder even when a seed run under-delivers.
 *
 * Re-run `npm run seed:cards` to refresh the generated half.
 */
const FIXTURE_CARDS: SongCard[] = SEED_ROWS.map(buildCard);

/**
 * Real cards only, as long as the seed run produced a usable pool. Fixtures
 * pad it out if a run under-delivers, so screens never render empty — but
 * with a healthy pool the app shows real songs and real covers exclusively.
 */
export const ALL_CARDS: SongCard[] =
  GENERATED_CARDS.length >= 8
    ? GENERATED_CARDS
    : [...GENERATED_CARDS, ...FIXTURE_CARDS.slice(0, 12 - GENERATED_CARDS.length)];

export const cardById = (id: string): SongCard | undefined =>
  ALL_CARDS.find((c) => c.id === id);

/** Pick the first card of a tier — keeps screens correct as the pool changes. */
const firstOf = (rarity: Rarity, skip = 0): SongCard | undefined =>
  ALL_CARDS.filter((c) => c.rarity === rarity)[skip];

/**
 * The player's opening hand — screen 02. Selected by rarity rather than index
 * so a re-seed cannot silently produce a hand of five commons.
 */
export const STARTING_HAND: SongCard[] = [
  firstOf('legendary'),
  firstOf('epic'),
  firstOf('rare'),
  firstOf('epic', 1) ?? firstOf('rare', 1),
  firstOf('common') ?? firstOf('rare', 2),
].filter((c): c is SongCard => Boolean(c));

