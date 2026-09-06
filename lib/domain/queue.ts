/**
 * The room's song queue.
 *
 * The gap this fills: playing a card while somebody holds the throne was
 * refused outright (`THRONE_HELD`), and when a reign ended the room simply
 * went silent -- `endReign` set `reign = null` and nothing followed it. So a
 * room could only ever play one song at a time, chosen by whoever tapped
 * first, with dead air in between. That is not a party.
 *
 * The Challenger Line already existed but it queues PEOPLE, not songs: a
 * challenger joins carrying no card, so when the throne frees up nothing
 * knows what to play. This queues the songs.
 *
 * ---------------------------------------------------------------------------
 * How it differs per control model (CLAUDE.md §1.1)
 *
 * The three control models disagree about who may ADD and who may REORDER,
 * so the queue is one structure with three policies rather than three
 * queues. Nothing here invents a fourth control model.
 *
 *   Contested  (Disco, Private Party)
 *     Anyone adds. Order is arrival order -- first in, first played. The
 *     throne is still won by playing, so the queue is what happens next
 *     when nobody has taken it.
 *
 *   Delegated  (Night Party)
 *     Anyone adds, the DJ picks. Order is by crowd support, so the queue is
 *     a request board and `winningNomination`'s logic applies: the most
 *     wanted song rises. The holder keeps control -- they can skip to any
 *     entry -- but they choose from what the crowd offered.
 *
 *   Spectator  (Concert, Fest, Clubbing)
 *     Only hosts add. The crowd sustains the vibe but never queues, which is
 *     what keeps a set a set. An add from a non-host is refused rather than
 *     silently dropped, so the UI can say why.
 *
 * Vibe never reorders anything. It scores the room; it does not vote.
 */

import type { FormatId } from './formats';
import { controlModelFor } from './formats';

export interface QueueEntry {
  /** Stable id, so a reorder cannot be confused with a re-add. */
  id: string;
  cardId: string;
  /** Who put it there — shown as credit, and who may remove it. */
  playerId: string;
  displayName: string;
  cardTitle: string;
  cardArtist: string;
  /*
    The card's stats, captured when it was queued.

    Carried here rather than re-read when it plays: promoting the queue head
    happens inside the vibe tick loop, and a database round trip there would
    stall every room on the server. The numbers cannot change under it — a
    card's hype and stamina are set once at mint (CLAUDE.md §2).
  */
  hype: number;
  stamina: number;
  /** Player ids. Duplicates ignored, like Nomination.votes. */
  votes: string[];
  addedAt: number;
}

export type QueueRefusal =
  | 'crowd_cannot_queue'   // Spectator: hosts play, the crowd listens
  | 'already_queued'       // the same card is already waiting
  | 'queue_full'
  | 'not_yours';           // removing somebody else's entry

/**
 * A ceiling, so one person cannot fill the night.
 *
 * Not a rule from CLAUDE.md -- a practical guard. Without it a single player
 * can queue their whole binder and nobody else gets a turn, which is the
 * social failure the Challenger Line's atomic position exists to prevent.
 */
export const QUEUE_MAX = 50;
export const PER_PLAYER_MAX = 5;

const uniqueVotes = (votes: string[]): number => new Set(votes).size;

/** Whether this player may add to this room's queue at all. */
export function canQueue(format: FormatId, isHost: boolean): boolean {
  // Spectator formats: hosts play, the crowd sustains but never queues.
  return controlModelFor(format) !== 'spectator' || isHost;
}

/**
 * Where a new entry belongs, or why it cannot be added.
 *
 * Returns the new queue rather than mutating, so the caller can compare and
 * the whole thing stays testable without a server.
 */
export function addToQueue(
  queue: QueueEntry[],
  entry: QueueEntry,
  opts: { format: FormatId; isHost: boolean },
): { ok: true; queue: QueueEntry[] } | { ok: false; reason: QueueRefusal } {
  if (!canQueue(opts.format, opts.isHost)) {
    return { ok: false, reason: 'crowd_cannot_queue' };
  }
  if (queue.length >= QUEUE_MAX) {
    return { ok: false, reason: 'queue_full' };
  }
  // The same song twice in a row is a mistake, not a request.
  if (queue.some((q) => q.cardId === entry.cardId)) {
    return { ok: false, reason: 'already_queued' };
  }
  if (queue.filter((q) => q.playerId === entry.playerId).length >= PER_PLAYER_MAX) {
    return { ok: false, reason: 'queue_full' };
  }

  return { ok: true, queue: [...queue, entry] };
}

/** Removing your own entry. Hosts may remove anything in their room. */
export function removeFromQueue(
  queue: QueueEntry[],
  entryId: string,
  playerId: string,
  isHost: boolean,
): { ok: true; queue: QueueEntry[] } | { ok: false; reason: QueueRefusal } {
  const entry = queue.find((q) => q.id === entryId);
  if (!entry) return { ok: true, queue };          // already gone; not an error
  if (!isHost && entry.playerId !== playerId) {
    return { ok: false, reason: 'not_yours' };
  }
  return { ok: true, queue: queue.filter((q) => q.id !== entryId) };
}

/** Toggles this player's vote on an entry. Votes are per player, not a count. */
export function voteFor(queue: QueueEntry[], entryId: string, playerId: string): QueueEntry[] {
  return queue.map((q) => {
    if (q.id !== entryId) return q;
    const has = q.votes.includes(playerId);
    return {
      ...q,
      votes: has ? q.votes.filter((v) => v !== playerId) : [...q.votes, playerId],
    };
  });
}

/**
 * The queue in the order this room actually plays it.
 *
 * Contested and Spectator play in arrival order -- a queue you can predict
 * is a queue people trust. Delegated sorts by crowd support, because that IS
 * the model: the crowd shapes the options and the DJ picks from the top.
 *
 * Ties break on `addedAt` then `id`, so every client sorting the same rows
 * lands on the same order. Two phones disagreeing about what plays next
 * would be worse than any ordering rule.
 */
export function playOrder(queue: QueueEntry[], format: FormatId): QueueEntry[] {
  const sorted = [...queue];

  if (controlModelFor(format) === 'delegated') {
    sorted.sort((a, b) => {
      const d = uniqueVotes(b.votes) - uniqueVotes(a.votes);
      if (d !== 0) return d;
      if (a.addedAt !== b.addedAt) return a.addedAt - b.addedAt;
      return a.id.localeCompare(b.id);
    });
    return sorted;
  }

  sorted.sort((a, b) => (a.addedAt - b.addedAt) || a.id.localeCompare(b.id));
  return sorted;
}

/** What plays when the throne frees up, or null when the queue is empty. */
export function nextUp(queue: QueueEntry[], format: FormatId): QueueEntry | null {
  return playOrder(queue, format)[0] ?? null;
}

/**
 * Whether this player may skip what is playing.
 *
 * Contested: nobody skips -- the throne is lost by vibe collapse or not at
 * all, and a skip button would be a dethrone that bypassed the crowd, which
 * is the one thing that model is about.
 *
 * Delegated and Spectator: the holder or the host may, because in both the
 * performer is choosing the set and a song they cannot end is a trap.
 */
export function canSkip(
  format: FormatId,
  opts: { isHost: boolean; holdsThrone: boolean },
): boolean {
  if (controlModelFor(format) === 'contested') return false;
  return opts.isHost || opts.holdsThrone;
}
