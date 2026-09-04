/**
 * Card type definitions — the runtime mirror of docs/CARD_SCHEMA.md.
 * Three card types (CLAUDE.md §2). Do not add a fourth.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CardKind = 'song' | 'profile' | 'guest';
export type ArtistRole = 'primary' | 'featured' | 'remixer' | 'producer';
/**
 * How a card makes a sound.
 *
 * 'apple_preview' is the 30s stream Apple serves CORS-open (usePreviewAudio)
 * and is what most of the chart-sourced pool uses; 'youtube_embed' is the
 * full track and needs a video id. The two are not interchangeable: a card
 * declaring the embed without a youtubeVideoId cannot play at all, which is
 * what 50 of 60 rows used to claim because 'youtube_embed' was the column
 * default and nothing ever set it deliberately.
 */
export type PlaybackMode =
  | 'youtube_embed'
  | 'apple_preview'
  | 'spotify_handoff'
  | 'jamendo_local'
  /**
   * Full-length stream from Audius, by track id, via
   * /v1/tracks/<id>/stream. The only full-length path in the pool that does
   * not need an embed: Apple's preview stops at 30s and only 10 of the 60
   * chart cards ever resolved a YouTube video id.
   *
   * Artists opt in to third-party API access under the Open Music License.
   * Only the id is stored; audio streams from an Audius content node and is
   * never downloaded (CLAUDE.md §5). Cross-origin, so NOT audioAnalyzable.
   */
  | 'audius_stream';
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
  /** Audius track id — streamed full-length, never downloaded. Optional: the
   *  hand-curated seed fixtures predate this source. */
  audiusTrackId?: string | null;

  /**
   * Apple's own 30-second preview stream. CORS-open, so unlike the YouTube
   * iframe this can be played by an <audio> element AND analysed by Web Audio
   * — which is what makes the FFT-driven Vibe Bar possible.
   *
   * Only the URL is stored; the audio always streams from Apple and is never
   * downloaded or cached (docs/LICENSING_RIGHTS.md DO NOT #1).
   *
   * Optional because the hand-curated seed fixtures predate it and legitimately
   * have no preview — those cards fall back to the YouTube embed.
   */
  previewUrl?: string | null;

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
