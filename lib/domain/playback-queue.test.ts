import { describe, it, expect } from 'vitest';
import {
  shuffleCards, nextPlayable, firstPlayable, applyOrder, isPlayable,
} from './playback-queue';
import type { SongCard } from '@/types/cards';

const card = (id: string, playable = true): SongCard =>
  ({ id, previewUrl: playable ? `https://x/${id}.m4a` : null } as unknown as SongCard);

const ids = (cards: SongCard[]) => cards.map((c) => c.id).join(' ');

describe('isPlayable', () => {
  it('is false without a preview url', () => {
    expect(isPlayable(card('a'))).toBe(true);
    expect(isPlayable(card('b', false))).toBe(false);
  });
});

describe('shuffleCards', () => {
  it('keeps every card exactly once', () => {
    const src = Array.from({ length: 40 }, (_, i) => card('c' + i));
    const out = shuffleCards(src);
    expect(out).toHaveLength(src.length);
    expect(new Set(out.map((c) => c.id)).size).toBe(src.length);
  });

  it('does not mutate the caller', () => {
    const src = Array.from({ length: 10 }, (_, i) => card('c' + i));
    const before = ids(src);
    shuffleCards(src);
    expect(ids(src)).toBe(before);
  });

  it('actually reorders', () => {
    // A shuffle that returns the input order is legal once; being identical
    // across many runs of 30 items means it is not shuffling at all.
    const src = Array.from({ length: 30 }, (_, i) => card('c' + i));
    const same = Array.from({ length: 12 }, () => ids(shuffleCards(src)) === ids(src));
    expect(same.every(Boolean)).toBe(false);
  });
});

describe('nextPlayable', () => {
  const q = [card('a'), card('b', false), card('c'), card('d')];

  it('skips cards that cannot play', () => {
    expect(nextPlayable(q, 'a')?.id).toBe('c');
  });

  it('returns null at the end rather than wrapping', () => {
    // Wrapping would make the library restart itself forever.
    expect(nextPlayable(q, 'd')).toBeNull();
  });

  it('starts at the top when nothing is playing', () => {
    expect(nextPlayable(q, null)?.id).toBe('a');
  });

  /*
    The profile-binder bug: playback resolved the current card against the
    UNFILTERED collection while the grid rendered the filtered one. Filter to
    a rarity that excludes the playing card and findIndex returns -1, which
    with the old `idx + 1` arithmetic silently became 0 — so "next" replayed
    the first visible card forever instead of advancing.
  */
  it('starts from the top when the playing card is not in the queue', () => {
    const filtered = [card('x'), card('y')];
    expect(nextPlayable(filtered, 'a')?.id).toBe('x');
  });

  it('returns null when nothing in the queue can play', () => {
    expect(nextPlayable([card('p', false), card('q', false)], null)).toBeNull();
  });
});

describe('firstPlayable', () => {
  it('finds the first that can play', () => {
    expect(firstPlayable([card('a', false), card('b')])?.id).toBe('b');
  });
  it('is null when none can', () => {
    expect(firstPlayable([card('a', false)])).toBeNull();
  });
});

describe('applyOrder', () => {
  const cards = [card('a'), card('b'), card('c')];

  it('returns the collection unchanged when there is no order', () => {
    expect(ids(applyOrder(cards, null))).toBe('a b c');
  });

  it('applies a saved order', () => {
    expect(ids(applyOrder(cards, ['c', 'a', 'b']))).toBe('c a b');
  });

  it('appends cards acquired since the shuffle', () => {
    // Opening a pack mid-shuffle must not make the queue shorter than the
    // collection it claims to be.
    const withNew = [...cards, card('d')];
    expect(ids(applyOrder(withNew, ['c', 'a', 'b']))).toBe('c a b d');
  });

  it('skips ids that no longer exist', () => {
    expect(ids(applyOrder(cards, ['c', 'gone', 'a', 'b']))).toBe('c a b');
  });

  it('never loses or duplicates a card', () => {
    const withNew = [...cards, card('d'), card('e')];
    const out = applyOrder(withNew, ['e', 'b']);
    expect(out).toHaveLength(withNew.length);
    expect(new Set(out.map((c) => c.id)).size).toBe(withNew.length);
  });
});
