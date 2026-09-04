/**
 * In-memory room state.
 *
 * Redis is the production target for ephemeral room/energy state
 * (CLAUDE.md §7) — this implementation keeps the same call shape so swapping
 * in ioredis is a change of backing store, not of logic. Single-process only:
 * scaling past one Render instance requires the Redis adapter.
 */

import type { RoomState, Challenger, Reign, Player, RoomMode } from '../../types/game';
import type { FormatId } from '../../lib/domain/formats';
import { startingVibeFor } from '../../lib/stats';
import { avatarFor } from '../../lib/rarity';
import type { ServerCard } from '../db/reigns';

interface GraceEntry {
  timer: NodeJS.Timeout;
  playerId: string;
}

export class RoomStore {
  private rooms = new Map<string, RoomState>();
  private holding = new Map<string, Set<string>>();
  private grace = new Map<string, GraceEntry>();
  /** Monotonic counter per room — the atomic source for queue positions. */
  private queueCounter = new Map<string, number>();

  ensure(roomId: string, mode: RoomMode = 'casual', format: FormatId = 'disco'): RoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        mode,
        // Disco is the default because it is the plain contested loop; a
        // room that means to be a Concert must say so when it is created,
        // rather than silently inheriting dethrone behaviour.
        format,
        name: roomId,
        vibe: 50,
        reign: null,
        challengers: [],
        players: [],
        soloPractice: true,
        updatedAt: Date.now(),
      };
      this.rooms.set(roomId, room);
      this.queueCounter.set(roomId, 0);
      this.holding.set(roomId, new Set());
    }
    return room;
  }

  all(): RoomState[] {
    return [...this.rooms.values()];
  }

  size(): number {
    return this.rooms.size;
  }

  addPlayer(roomId: string, p: { id: string; displayName: string }): void {
    const room = this.ensure(roomId);
    if (room.players.some((x) => x.id === p.id)) return;

    const initials = p.displayName
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    room.players.push({
      id: p.id,
      displayName: p.displayName,
      initials,
      avatarGradient: avatarFor(p.id),
      drops: 0,
    });

    // Solo Practice is a labeled mode, never a silent fallback (CLAUDE.md §6).
    room.soloPractice = room.players.length < 2;
    room.updatedAt = Date.now();
  }

  removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    room.challengers = room.challengers.filter((c) => c.playerId !== playerId);
    this.holding.get(roomId)?.delete(playerId);
    room.soloPractice = room.players.length < 2;
    room.updatedAt = Date.now();
  }

  /**
   * Atomic increment for queue position.
   *
   * Two players tapping "join" in the same tick must get 1 and 2, never both
   * getting 1. A counter read-modify-write inside one synchronous block is
   * atomic under Node's single-threaded model; the Redis equivalent is INCR.
   */
  joinChallengerLine(roomId: string, playerId: string): Challenger | null {
    const room = this.ensure(roomId);
    if (room.challengers.some((c) => c.playerId === playerId)) return null;

    const next = (this.queueCounter.get(roomId) ?? 0) + 1;
    this.queueCounter.set(roomId, next);

    const player = room.players.find((p) => p.id === playerId);
    const challenger: Challenger = {
      playerId,
      initials: player?.initials ?? '??',
      avatarGradient: player?.avatarGradient ?? avatarFor(playerId),
      position: next,
      joinedAt: Date.now(),
    };

    room.challengers.push(challenger);
    room.updatedAt = Date.now();
    return challenger;
  }

  /*
    The card is resolved by the caller rather than looked up here.

    This used to call cardById() from lib/seed-data.ts — a ten-card design
    fixture keyed by ids like `gen-000`, while every real card id is a uuid.
    Once the app served real cards the two pools shared no id, so every play
    of a real card came back CARD_NOT_FOUND and multiplayer card play worked
    only for cards that no longer existed.

    Taking the card as an argument keeps this method synchronous and pure —
    the room rules below are worth testing without a database — and puts the
    lookup where the await already is.
  */
  playCard(
    roomId: string,
    playerId: string,
    card: ServerCard | undefined,
  ): { reign: Reign } | { error: { code: string; message: string } } {
    const room = this.ensure(roomId);

    if (!card) {
      return { error: { code: 'CARD_NOT_FOUND', message: 'That card does not exist.' } };
    }

    // The ONE place room mode branches logic (CLAUDE.md §4).
    // Guest Cards are Casual-only; Event Rooms require owned cards.
    if (room.mode === 'event' && card.kind !== 'song') {
      return {
        error: {
          code: 'GUEST_BLOCKED',
          message: 'Event Rooms require owned cards.',
        },
      };
    }

    if (room.reign) {
      return { error: { code: 'THRONE_HELD', message: 'Someone already holds the throne.' } };
    }

    const player = room.players.find((p) => p.id === playerId);
    const reign: Reign = {
      playerId,
      displayName: player?.displayName ?? 'Unknown',
      initials: player?.initials ?? '??',
      cardId: card.id,
      cardTitle: card.title,
      cardArtist: card.subtitle,
      startingVibe: startingVibeFor(card.hype),
      decayRate: card.stamina,
      startedAt: Date.now(),
      peakVibe: startingVibeFor(card.hype),
      peakMomentsTriggered: 0,
    };

    room.reign = reign;
    room.vibe = reign.startingVibe;
    room.challengers = room.challengers.filter((c) => c.playerId !== playerId);
    room.updatedAt = Date.now();

    return { reign };
  }

  endReign(roomId: string, _reason: 'dethroned' | 'left'): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.reign = null;
    room.vibe = 50;
    room.updatedAt = Date.now();
  }

  setHolding(roomId: string, playerId: string, holding: boolean): void {
    const set = this.holding.get(roomId) ?? new Set<string>();
    if (holding) set.add(playerId);
    else set.delete(playerId);
    this.holding.set(roomId, set);
  }

  holdingCount(roomId: string): number {
    return this.holding.get(roomId)?.size ?? 0;
  }

  // --- Reconnect grace (CLAUDE.md §6): hold the last known vibe, never zero ---

  startGrace(roomId: string, playerId: string, ms: number, onExpire: () => void): void {
    const key = `${roomId}:${playerId}`;
    this.cancelGrace(roomId, playerId);
    this.grace.set(key, {
      playerId,
      timer: setTimeout(() => {
        this.grace.delete(key);
        onExpire();
      }, ms),
    });
  }

  cancelGrace(roomId: string, playerId: string): void {
    const key = `${roomId}:${playerId}`;
    const entry = this.grace.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      this.grace.delete(key);
    }
  }

  isInGrace(roomId: string, playerId: string): boolean {
    return this.grace.has(`${roomId}:${playerId}`);
  }
}
