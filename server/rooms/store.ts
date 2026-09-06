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
import { addToQueue, removeFromQueue, voteFor, nextUp, type QueueEntry } from '../../lib/domain/queue';

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
  /** Monotonic entry id for queued songs. Distinct from queueCounter, which
      numbers positions in the CHALLENGER line, not the song queue. */
  private queueSeq = 0;

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
        hostId: null,
        vibe: 50,
        reign: null,
        queue: [],
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
  ): { reign: Reign }
    | { queued: QueueEntry }
    | { error: { code: string; message: string } } {
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

    /*
      Somebody is already playing, so this one goes in the queue rather than
      being refused.

      Refusing was the old behaviour, and it meant a room played exactly one
      song: everyone else got THRONE_HELD and the night stopped. Queueing is
      what makes it a party rather than a turn.

      Whether this player may queue at all depends on the control model --
      in a Spectator format the crowd sustains but never picks (§1.1) -- so
      the decision is made by lib/domain/queue.ts, not here.
    */
    if (room.reign) {
      const player = room.players.find((p) => p.id === playerId);
      const added = addToQueue(
        room.queue,
        {
          id: `q${++this.queueSeq}`,
          cardId: card.id,
          playerId,
          displayName: player?.displayName ?? 'Unknown',
          cardTitle: card.title,
          cardArtist: card.subtitle,
          hype: card.hype,
          stamina: card.stamina,
          votes: [],
          addedAt: Date.now(),
        },
        { format: room.format, isHost: room.hostId === playerId },
      );

      if (!added.ok) {
        return {
          error: {
            code: added.reason === 'crowd_cannot_queue' ? 'CROWD_CANNOT_QUEUE' : 'QUEUE_REFUSED',
            message:
              added.reason === 'crowd_cannot_queue'
                ? 'Only the host queues songs in this room.'
                : added.reason === 'already_queued'
                  ? 'That song is already in the queue.'
                  : 'The queue is full.',
          },
        };
      }

      room.queue = added.queue;
      room.updatedAt = Date.now();
      return { queued: added.queue[added.queue.length - 1] };
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

  /**
   * Ends the current reign and starts whatever is queued next.
   *
   * Returns the reign that took over, or null when the queue is empty and
   * the room really does fall silent. This used to just null the reign, so
   * every song was followed by dead air until somebody noticed and played
   * again -- the single biggest reason a room did not feel live.
   */
  endReign(roomId: string, _reason: 'dethroned' | 'left'): Reign | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.reign = null;
    room.vibe = 50;
    room.updatedAt = Date.now();

    const next = nextUp(room.queue, room.format);
    if (!next) return null;

    room.queue = room.queue.filter((q) => q.id !== next.id);

    /*
      The queue entry carries the stats the reign needs, captured when it was
      added. Re-reading the card here would mean a database round trip inside
      the tick loop, and the card cannot change under it anyway.
    */
    const reign: Reign = {
      playerId: next.playerId,
      displayName: next.displayName,
      initials: next.displayName.slice(0, 2).toUpperCase(),
      cardId: next.cardId,
      cardTitle: next.cardTitle,
      cardArtist: next.cardArtist,
      startingVibe: startingVibeFor(next.hype),
      decayRate: next.stamina,
      startedAt: Date.now(),
      peakVibe: startingVibeFor(next.hype),
      peakMomentsTriggered: 0,
    };

    room.reign = reign;
    room.vibe = reign.startingVibe;
    room.updatedAt = Date.now();
    return reign;
  }

  /** Removing an entry. Only the owner or the host may. */
  removeQueued(roomId: string, entryId: string, playerId: string): boolean {
    const room = this.ensure(roomId);
    const res = removeFromQueue(room.queue, entryId, playerId, room.hostId === playerId);
    if (!res.ok) return false;
    room.queue = res.queue;
    room.updatedAt = Date.now();
    return true;
  }

  /** A vote nudges a Delegated room's order. Inert elsewhere by design. */
  voteQueued(roomId: string, entryId: string, playerId: string): void {
    const room = this.ensure(roomId);
    room.queue = voteFor(room.queue, entryId, playerId);
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
