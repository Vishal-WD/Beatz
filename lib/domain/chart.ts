/**
 * The world chart: which cards the room has actually claimed.
 *
 * This replaces a fixture called BIDS that listed invented Drop amounts
 * against four hardcoded player names. There is no bidding in this app —
 * CLAUDE.md §3 keeps Drops earn-only alongside a card-sell path, and a live
 * bid board is exactly the combination that section exists to avoid.
 *
 * What IS real is scarcity: supply is finite and every pull decrements it,
 * so "how much of this card is gone" is a fact the database already holds.
 */

import type { Rarity } from '@/types/cards';

export interface ChartRow {
  cardId: string;
  title: string;
  subtitle: string;
  rarity: Rarity;
  artworkUrl: string | null;
  supplyTotal: number;
  supplyRemaining: number;
}

export interface ChartEntry extends ChartRow {
  /** Fraction of the printed supply now owned, 0..1. */
  scarcity: number;
  rank: number;
}

export function buildChart(rows: ChartRow[], limit = 50): ChartEntry[] {
  return rows
    .map((r) => ({
      ...r,
      // A card with no recorded supply is not infinitely scarce; it is
      // unknown, so it scores 0 rather than NaN or Infinity.
      scarcity: r.supplyTotal > 0
        ? (r.supplyTotal - r.supplyRemaining) / r.supplyTotal
        : 0,
      rank: 0,
    }))
    // Ties break on absolute copies left, so the last few of a legendary
    // outrank a common that happens to be the same percentage gone.
    .sort((a, b) => b.scarcity - a.scarcity || a.supplyRemaining - b.supplyRemaining)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
