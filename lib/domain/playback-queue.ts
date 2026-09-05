/**
 * Choosing what plays next, as pure functions.
 *
 * This lived inline in two screens (the HOME library and the profile
 * binder) and drifted apart, which is how both of them ended up with the
 * same class of bug in different places: the list you can SEE and the list
 * playback walks were not the same list.
 *
 * Pure, so the sequencing can be tested without an <audio> element.
 */

import type { SongCard } from '@/types/cards';

/** A card can actually make a sound. */
export const isPlayable = (c: SongCard): boolean => Boolean(c.previewUrl);

/**
 * Fisher–Yates. Returns a new array; the caller's order is never touched,
 * because the collection it came from is rendered elsewhere.
 */
export function shuffleCards<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The next playable card strictly after `currentId`.
 *
 * Returns null at the end of the queue rather than wrapping: a library that
 * silently restarts is a library you cannot leave running.
 *
 * `currentId` not being in the queue is a real case, not an error — it is
 * what happens when a filter removes the playing card — and it means "start
 * from the top of what is now visible".
 */
export function nextPlayable(queue: SongCard[], currentId: string | null): SongCard | null {
  const from = currentId === null ? 0 : queue.findIndex((c) => c.id === currentId) + 1;
  for (let i = Math.max(from, 0); i < queue.length; i++) {
    if (isPlayable(queue[i])) return queue[i];
  }
  return null;
}

/** The first card that can play, or null when none can. */
export const firstPlayable = (queue: SongCard[]): SongCard | null =>
  queue.find(isPlayable) ?? null;

/**
 * Applies a saved shuffle order to a live collection.
 *
 * Cards acquired since the shuffle are appended rather than dropped, so the
 * queue can never be shorter than the collection it claims to represent,
 * and ids in the order that no longer exist are skipped.
 */
export function applyOrder(cards: SongCard[], order: string[] | null): SongCard[] {
  if (!order) return cards;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const picked = order
    .map((id) => byId.get(id))
    .filter((c): c is SongCard => c !== undefined);
  const seen = new Set(picked.map((c) => c.id));
  return [...picked, ...cards.filter((c) => !seen.has(c.id))];
}
