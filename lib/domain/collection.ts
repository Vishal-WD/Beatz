/**
 * Filtering a player's own collection.
 *
 * Pure, so the filter logic is testable without rendering the binder, and
 * so the same rules can be reused by any screen that shows cards.
 */

import type { Rarity, SongCard } from '@/types/cards';

export type RarityFilter = 'all' | Rarity;
export type LanguageFilter = 'all' | string;

export interface CollectionFilters {
  rarity: RarityFilter;
  language: LanguageFilter;
}

export function filterCollection(cards: SongCard[], f: CollectionFilters): SongCard[] {
  return cards.filter(
    (c) =>
      (f.rarity === 'all' || c.rarity === f.rarity) &&
      (f.language === 'all' || c.language === f.language),
  );
}

/**
 * The languages actually present, sorted. Derived from the cards rather
 * than hardcoded: the catalogue holds four today (english, hindi, tamil,
 * telugu) and adding a fifth must not require touching the UI.
 */
export function languagesIn(cards: SongCard[]): string[] {
  const set = new Set<string>();
  for (const c of cards) if (c.language) set.add(c.language);
  return [...set].sort();
}

const EMPTY: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };

/** Every rarity is present in the result, including those with a count of 0. */
export function countsByRarity(cards: SongCard[]): Record<Rarity, number> {
  const out = { ...EMPTY };
  for (const c of cards) out[c.rarity] += 1;
  return out;
}
