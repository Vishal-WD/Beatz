/**
 * Pack economics.
 *
 * Pure and roll-injected: the caller supplies the random numbers, so the
 * odds are testable without stubbing Math.random and the server can use the
 * same table the client displays.
 */

import type { Rarity } from '@/types/cards';

/** Earned Drops only. Never purchasable with money (CLAUDE.md §3). */
export const PACK_COST = 250;
export const PACK_SIZE = 5;

export interface PackOdds {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

/**
 * Fixed odds. CLAUDE.md §3 rejects any curve that scales legendary chance
 * with playtime or spend, so these are constants — the same for a first
 * pack and a five-hundredth.
 */
export const PACK_ODDS: PackOdds = {
  common: 0.70,
  rare: 0.22,
  epic: 0.07,
  legendary: 0.01,
};

/** What a pull is worth, used for downgrade refunds. */
const TIER_VALUE: Record<Rarity, number> = {
  common: 10,
  rare: 40,
  epic: 120,
  legendary: 400,
};

export function rollRarity(roll: number): Rarity {
  // Walk the cumulative distribution from the rarest end so floating point
  // slop lands in `common` (the widest band) rather than off the end.
  const r = Math.min(Math.max(roll, 0), 0.9999999);
  if (r >= 1 - PACK_ODDS.legendary) return 'legendary';
  if (r >= 1 - PACK_ODDS.legendary - PACK_ODDS.epic) return 'epic';
  if (r >= 1 - PACK_ODDS.legendary - PACK_ODDS.epic - PACK_ODDS.rare) return 'rare';
  return 'common';
}

export const rollPack = (rolls: number[]): Rarity[] => rolls.map(rollRarity);

export const canAfford = (drops: number): boolean => drops >= PACK_COST;

/**
 * §6: a tier that is sold out downgrades one step and refunds the
 * difference, rather than failing the pull outright.
 */
export const refundFor = (from: Rarity, to: Rarity): number =>
  Math.max(0, TIER_VALUE[from] - TIER_VALUE[to]);
