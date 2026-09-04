import { describe, it, expect } from 'vitest';
import { filterCollection, languagesIn, countsByRarity } from './collection';
import type { SongCard } from '@/types/cards';

const card = (id: string, rarity: SongCard['rarity'], language: string | null) =>
  ({ id, rarity, language, title: id, kind: 'song' } as unknown as SongCard);

const pool = [
  card('a', 'common', 'tamil'),
  card('b', 'legendary', 'hindi'),
  card('c', 'rare', 'tamil'),
  card('d', 'epic', 'english'),
  card('e', 'common', null),
];

describe('collection filtering', () => {
  it('returns everything when both filters are all', () => {
    expect(filterCollection(pool, { rarity: 'all', language: 'all' })).toHaveLength(5);
  });

  it('filters by rarity', () => {
    expect(filterCollection(pool, { rarity: 'common', language: 'all' }).map((c) => c.id))
      .toEqual(['a', 'e']);
  });

  it('filters by language', () => {
    expect(filterCollection(pool, { rarity: 'all', language: 'tamil' }).map((c) => c.id))
      .toEqual(['a', 'c']);
  });

  it('combines both filters', () => {
    expect(filterCollection(pool, { rarity: 'common', language: 'tamil' }).map((c) => c.id))
      .toEqual(['a']);
  });

  it('returns an empty list rather than everything when nothing matches', () => {
    expect(filterCollection(pool, { rarity: 'legendary', language: 'tamil' })).toEqual([]);
  });

  // Languages come from the cards, not a hardcoded list: the catalogue has
  // four today (english, hindi, tamil, telugu) and adding a fifth must not
  // require touching the UI.
  it('derives the language list from the cards themselves, sorted', () => {
    expect(languagesIn(pool)).toEqual(['english', 'hindi', 'tamil']);
  });

  it('omits cards with no language from the language list', () => {
    expect(languagesIn(pool)).not.toContain(null);
    expect(languagesIn(pool)).not.toContain('');
  });

  it('counts every rarity, including the ones with none', () => {
    expect(countsByRarity(pool)).toEqual({ common: 2, rare: 1, epic: 1, legendary: 1 });
    expect(countsByRarity([])).toEqual({ common: 0, rare: 0, epic: 0, legendary: 0 });
  });

  it('does not mutate the caller’s array', () => {
    const before = pool.map((c) => c.id).join(',');
    filterCollection(pool, { rarity: 'common', language: 'all' });
    languagesIn(pool);
    expect(pool.map((c) => c.id).join(',')).toBe(before);
  });
});
