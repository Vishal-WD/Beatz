/**
 * Card type definitions — the runtime mirror of docs/CARD_SCHEMA.md.
 * Three card types (CLAUDE.md §2). Do not add a fourth.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CardKind = 'song' | 'profile' | 'guest';
export type ArtistRole = 'primary' | 'featured' | 'remixer' | 'producer';
export type PlaybackMode = 'youtube_embed' | 'spotify_handoff' | 'jamendo_local';
export type ArtworkSource = 'caa' | 'spotify' | 'itunes' | 'os_sync' | null;

export interface CardDisplayBase {
  id: string;
  kind: CardKind;
  title: string;
  subtitle: string;
  artworkUrl: string | null;
  /** Drives attribution: iTunes requires a store badge (LICENSING_RIGHTS.md §2.5). */
  artworkSource: ArtworkSource;
  rarity: Rarity;
  primaryStat: number;
  secondaryStat: number;
  flavorText: string | null;
  /** Display language tag ("tamil" | "hindi" | "english" | …). Null for fixtures. */
  language?: string | null;
  createdAt: string;
}

export interface CardArtist {
  mbArtistId: string;
  name: string;
  role: ArtistRole;
  /** MusicBrainz's own join phrase — preserves "A feat. B" ordering. */
  joinPhrase: string | null;
}

export interface PopularitySnapshot {
  spotifyPopularity: number | null;
  spotifyFollowers: number | null;
  deezerRank: number | null;
  /** Stats freeze at mint. A song trending later does not buff existing cards. */
  capturedAt: string;
}

export interface SongCard extends CardDisplayBase {
  kind: 'song';

  mbRecordingId: string;
  mbReleaseGroupId: string | null;
  isrc: string | null;

  spotifyTrackId: string | null;
  deezerTrackId: string | null;
  youtubeVideoId: string | null;
  jamendoTrackId: string | null;

  artists: CardArtist[];
  isCollab: boolean;

  hype: number;
  stamina: number;
  popularitySnapshot: PopularitySnapshot;

  serialNumber: number;
  supplyTotal: number;
  supplyRemaining: number;

  playbackMode: PlaybackMode;
  /** TRUE only for jamendo_local — Web Audio FFT needs same-origin audio. */
  audioAnalyzable: boolean;
  licenseVariant: string | null;
  attributionText: string | null;
  licenseUrl: string | null;
}

export interface ProfileCard extends CardDisplayBase {
  kind: 'profile';
  userId: string;
  displayName: string;
  initials: string;
  tier: string;
  seasonBadge: string | null;

  totalReignsWon: number;
  peakVibe: number;
  challengerWinRate: number;
  totalDrops: number;
  cardsOwned: number;
}

export interface GuestCard extends CardDisplayBase {
  kind: 'guest';
  rarity: 'common';
  sourceRoomId: string;
  expiresAt: string;
  osSyncSource: 'mpris2' | 'manual';
  rawTitle: string;
  rawArtist: string;
  mbRecordingId: string | null;
  hype: number;
  stamina: number;
  /** Literal false: a mistaken assignment fails at compile time, never mints supply. */
  isOwnable: false;
  allowedInEventRoom: false;
}

export type AnyCard = SongCard | ProfileCard | GuestCard;

export const isSongCard = (c: AnyCard): c is SongCard => c.kind === 'song';
export const isGuestCard = (c: AnyCard): c is GuestCard => c.kind === 'guest';
export const isProfileCard = (c: AnyCard): c is ProfileCard => c.kind === 'profile';
