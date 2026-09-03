import type { FormatId } from '../lib/domain/formats';
/**
 * Game state types — the core loop (CLAUDE.md §1):
 *   Hold throne → Vibe Bar sustains or decays → dethrone/defend → next Challenger
 *
 * There is exactly ONE loop. These types describe variants of it, never a
 * second independent mechanic.
 */

import type { SongCard, GuestCard } from './cards';

/** CLAUDE.md §4 — the only place room "mode" branches logic. */
export type RoomMode = 'casual' | 'event';

export interface Player {
  id: string;
  displayName: string;
  initials: string;
  avatarGradient: string;
  drops: number;
}

export interface Challenger {
  playerId: string;
  initials: string;
  avatarGradient: string;
  /** Assigned by atomic increment, never array push (CLAUDE.md §6). */
  position: number;
  joinedAt: number;
}

export interface Reign {
  playerId: string;
  displayName: string;
  initials: string;
  cardId: string;
  cardTitle: string;
  cardArtist: string;
  /** Card hype sets the opening Vibe position; stamina sets decay rate. */
  startingVibe: number;
  decayRate: number;
  startedAt: number;
  peakVibe: number;
  peakMomentsTriggered: number;
}

export interface RoomState {
  roomId: string;
  mode: RoomMode;
  /**
   * Which of the six formats this room runs, and therefore which control
   * model governs it (CLAUDE.md §1.1). Without this the server cannot tell
   * a Concert from a Disco and dethrones in every room — which breaks the
   * rule that a spectator set is scored by vibe but never ended by it.
   *
   * Independent of `mode`: `format` decides who may take the throne,
   * `mode` decides which cards may be played. Never merge them (§1.1).
   */
  format: FormatId;
  name: string;
  vibe: number;
  reign: Reign | null;
  challengers: Challenger[];
  players: Player[];
  /** True when too few players for real crowd energy (CLAUDE.md §6). */
  soloPractice: boolean;
  updatedAt: number;
}

/** Vibe below this for `DETHRONE_GRACE_MS` ends the reign. */
export const DETHRONE_THRESHOLD = 25;

/**
 * WebSocket drop mid-reign holds the last known Vibe before decay resumes
 * (CLAUDE.md §6) — never an instant zero.
 */
export const RECONNECT_GRACE_MS = 4000;

/** Vibe simulation tick. Matches the design prototype's cadence. */
export const VIBE_TICK_MS = 420;

export const VIBE_MIN = 12;
export const VIBE_MAX = 99;

// ---------------------------------------------------------------------------
// Socket.io event contracts — shared by client and server so a rename breaks
// the build rather than failing silently at runtime.
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'vibe:update': (payload: { vibe: number; at: number }) => void;
  'reign:started': (reign: Reign) => void;
  'reign:ended': (payload: { playerId: string; reason: 'dethroned' | 'left' }) => void;
  'peak:moment': (payload: { playerId: string; dropsAwarded: number; cardMinted: string | null }) => void;
  'challenger:joined': (challenger: Challenger) => void;
  'error:msg': (payload: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'room:join': (payload: { roomId: string; playerId: string; displayName: string }) => void;
  'room:leave': (payload: { roomId: string }) => void;
  'card:play': (payload: { roomId: string; cardId: string }) => void;
  'vibe:hold': (payload: { roomId: string; holding: boolean }) => void;
  'challenger:join': (payload: { roomId: string }) => void;
}

/** Rejected when a Guest Card is played into an Event Room (CLAUDE.md §4). */
export type PlayableCard = SongCard | GuestCard;
