import { describe, it, expect } from 'vitest';
import {
  PACKS, rollRarity, rollPack, applyGuarantee, canAfford, refundFor,
  type PackTier,
} from './packs';

const TIERS: PackTier[] = ['starter', 'night', 'headliner'];

describe('pack tiers', () => {
  it('prices the three tiers as the spec sets them', () => {
    expect(PACKS.starter.cost).toBe(150);
    expect(PACKS.night.cost).toBe(400);
    expect(PACKS.headliner.cost).toBe(900);
  });

  it('sizes them 3 / 5 / 5', () => {
    expect(PACKS.starter.size).toBe(3);
    expect(PACKS.night.size).toBe(5);
    expect(PACKS.headliner.size).toBe(5);
  });

  it('gives every tier odds that sum to exactly 1', () => {
    for (const t of TIERS) {
      const o = PACKS[t].odds;
      expect(o.common + o.rare + o.epic + o.legendary, t).toBeCloseTo(1, 10);
    }
  });

  // CLAUDE.md §3: legendary must stay the rarest slice in EVERY tier — a
  // better pack shifts the odds, it never inverts the rarity ladder.
  it('keeps legendary rarest and common commonest in every tier', () => {
    for (const t of TIERS) {
      const o = PACKS[t].odds;
      expect(o.legendary, t).toBeLessThan(o.epic);
      expect(o.epic, t).toBeLessThan(o.rare);
      expect(o.rare, t).toBeLessThan(o.common);
    }
  });

  it('improves the odds as the tier gets more expensive', () => {
    expect(PACKS.night.odds.legendary).toBeGreaterThan(PACKS.starter.odds.legendary);
    expect(PACKS.headliner.odds.legendary).toBeGreaterThan(PACKS.night.odds.legendary);
  });

  it('never returns undefined for any roll in [0,1) in any tier', () => {
    for (const t of TIERS) {
      for (let i = 0; i < 500; i++) {
        expect(['common', 'rare', 'epic', 'legendary'], t).toContain(rollRarity(i / 500, t));
      }
    }
  });

  it('draws one tier per roll', () => {
    expect(rollPack([0, 0, 0], 'starter')).toEqual(['common', 'common', 'common']);
  });

  // Only headliner guarantees anything. §3 allows a discrete floor; it
  // forbids a curve that improves with how much you have played or spent.
  it('guarantees an epic or better only in headliner', () => {
    expect(PACKS.starter.guarantee).toBeNull();
    expect(PACKS.night.guarantee).toBeNull();
    expect(PACKS.headliner.guarantee).toBe('epic');
  });

  it('upgrades one card when a headliner pull has no epic or better', () => {
    const all: import('@/types/cards').Rarity[] = ['common', 'common', 'common', 'common', 'common'];
    const out = applyGuarantee(all, 'headliner', 0);
    expect(out).toHaveLength(5);
    expect(out.some((r) => r === 'epic' || r === 'legendary')).toBe(true);
    // Exactly one card is lifted — the guarantee is a floor, not a reroll.
    expect(out.filter((r) => r === 'common')).toHaveLength(4);
  });

  it('leaves a headliner pull alone when it already met the floor', () => {
    const already: import('@/types/cards').Rarity[] = ['common', 'legendary', 'common', 'common', 'common'];
    expect(applyGuarantee(already, 'headliner', 0)).toEqual(already);
  });

  it('never applies a guarantee to the untiered packs', () => {
    const all: import('@/types/cards').Rarity[] = ['common', 'common', 'common'];
    expect(applyGuarantee(all, 'starter', 0)).toEqual(all);
    expect(applyGuarantee(all, 'night', 0)).toEqual(all);
  });

  // The all-common fixture above cannot tell "lifts the weakest" from
  // "lifts whichever card is first" -- every card is tied. This one can:
  // the sole common sits at index 1, so lifting index 0 would leave it
  // behind and fail.
  it('lifts the weakest card, not simply the first', () => {
    const mixed: import('@/types/cards').Rarity[] =
      ['rare', 'common', 'rare', 'rare', 'rare'];
    const out = applyGuarantee(mixed, 'headliner', 0);
    expect(out[1]).toBe('epic');          // the common was the weakest
    expect(out[0]).toBe('rare');          // the first card is untouched
    expect(out.filter((r) => r === 'rare')).toHaveLength(4);
  });

  it('affords a tier only with enough Drops for that tier', () => {
    expect(canAfford(150, 'starter')).toBe(true);
    expect(canAfford(149, 'starter')).toBe(false);
    expect(canAfford(500, 'night')).toBe(true);
    expect(canAfford(500, 'headliner')).toBe(false);
  });

  // §6: an exhausted tier downgrades and refunds, never hard-fails.
  it('refunds the difference when a pull downgrades a tier', () => {
    expect(refundFor('legendary', 'epic')).toBeGreaterThan(0);
    expect(refundFor('epic', 'common')).toBeGreaterThan(refundFor('epic', 'rare'));
    expect(refundFor('rare', 'rare')).toBe(0);
  });
});
