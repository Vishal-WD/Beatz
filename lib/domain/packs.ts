/**
 * Pack economics.
 *
 * Pure and roll-injected: the caller supplies the random numbers, so the
 * odds are testable without stubbing Math.random and the screen can show
 * the same table the server rolls against.
 *
 * NOTE: the odds below are duplicated in the `open_pack` SQL function, and
 * THE SQL COPY IS AUTHORITATIVE because it is what actually grants cards.
 * This copy exists so the shop can price and describe a pack without a
 * round trip. Change both together.
 */

import type { Rarity } from '@/types/cards';

export type PackTier = 'starter' | 'night' | 'headliner';

export interface PackOdds {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface PackDef {
  id: PackTier;
  label: string;
  /** Earned Drops only. Never purchasable with money (CLAUDE.md §3). */
  cost: number;
  size: number;
  odds: PackOdds;
  /**
   * The floor a pull is lifted to when it misses. A discrete guarantee is
   * allowed by §3; a curve that improves with playtime or spend is not, so
   * this is a fixed rarity or nothing.
   */
  guarantee: Rarity | null;
}

export const PACKS: Record<PackTier, PackDef> = {
  starter: {
    id: 'starter',
    label: 'STARTER',
    cost: 150,
    size: 3,
    odds: { common: 0.78, rare: 0.18, epic: 0.035, legendary: 0.005 },
    guarantee: null,
  },
  night: {
    id: 'night',
    label: 'NIGHT',
    cost: 400,
    size: 5,
    odds: { common: 0.70, rare: 0.22, epic: 0.07, legendary: 0.01 },
    guarantee: null,
  },
  headliner: {
    id: 'headliner',
    label: 'HEADLINER',
    cost: 900,
    size: 5,
    odds: { common: 0.52, rare: 0.30, epic: 0.15, legendary: 0.03 },
    guarantee: 'epic',
  },
};

/** What a pull is worth, used for downgrade refunds. */
const TIER_VALUE: Record<Rarity, number> = {
  common: 10,
  rare: 40,
  epic: 120,
  legendary: 400,
};

export function rollRarity(roll: number, tier: PackTier): Rarity {
  const o = PACKS[tier].odds;
  // Walk the cumulative distribution from the rarest end so floating point
  // slop lands in `common` (the widest band) rather than off the end.
  const r = Math.min(Math.max(roll, 0), 0.9999999);
  if (r >= 1 - o.legendary) return 'legendary';
  if (r >= 1 - o.legendary - o.epic) return 'epic';
  if (r >= 1 - o.legendary - o.epic - o.rare) return 'rare';
  return 'common';
}

export const rollPack = (rolls: number[], tier: PackTier): Rarity[] =>
  rolls.map((r) => rollRarity(r, tier));

const ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/**
 * Lifts ONE card to the tier's guaranteed floor when the pull missed it.
 *
 * A floor, not a reroll: the other cards are untouched, so a headliner that
 * already rolled a legendary is returned unchanged rather than being given
 * a second chance at one.
 */
export function applyGuarantee(pulled: Rarity[], tier: PackTier, roll: number): Rarity[] {
  const floor = PACKS[tier].guarantee;
  if (!floor) return pulled;

  const floorIdx = ORDER.indexOf(floor);
  if (pulled.some((r) => ORDER.indexOf(r) >= floorIdx)) return pulled;

  // Lift the weakest card, so the guarantee costs the pull as little as
  // possible; `roll` breaks ties deterministically when several are equal.
  let weakest = 0;
  for (let i = 1; i < pulled.length; i++) {
    if (ORDER.indexOf(pulled[i]) < ORDER.indexOf(pulled[weakest])) weakest = i;
  }
  const pick = Math.min(Math.floor(Math.max(roll, 0) * pulled.length), pulled.length - 1);
  const target = ORDER.indexOf(pulled[pick]) === ORDER.indexOf(pulled[weakest]) ? pick : weakest;

  const out = [...pulled];
  out[target] = floor;
  return out;
}

export const canAfford = (drops: number, tier: PackTier): boolean =>
  drops >= PACKS[tier].cost;

/**
 * §6: a tier that is sold out downgrades one step and refunds the
 * difference, rather than failing the pull outright.
 */
export const refundFor = (from: Rarity, to: Rarity): number =>
  Math.max(0, TIER_VALUE[from] - TIER_VALUE[to]);
