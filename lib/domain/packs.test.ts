import { describe, it, expect } from 'vitest';
import { PACK_COST, PACK_SIZE, PACK_ODDS, rollRarity, rollPack, canAfford, refundFor } from './packs';

describe('pack odds', () => {
  it('costs 250 Drops and yields 5 cards', () => {
    expect(PACK_COST).toBe(250);
    expect(PACK_SIZE).toBe(5);
  });

  it('has odds that sum to exactly 1', () => {
    const sum = PACK_ODDS.common + PACK_ODDS.rare + PACK_ODDS.epic + PACK_ODDS.legendary;
    expect(sum).toBeCloseTo(1, 10);
  });

  // CLAUDE.md §3: legendary must stay rare and FIXED — never a ramp.
  it('keeps legendary the rarest slice', () => {
    expect(PACK_ODDS.legendary).toBeLessThan(PACK_ODDS.epic);
    expect(PACK_ODDS.epic).toBeLessThan(PACK_ODDS.rare);
    expect(PACK_ODDS.rare).toBeLessThan(PACK_ODDS.common);
  });

  it('maps a roll deterministically onto a tier', () => {
    expect(rollRarity(0)).toBe('common');
    expect(rollRarity(0.999999)).toBe('legendary');
  });

  it('never returns undefined for any roll in [0,1)', () => {
    for (let i = 0; i < 1000; i++) {
      const r = rollRarity(i / 1000);
      expect(['common', 'rare', 'epic', 'legendary']).toContain(r);
    }
  });

  it('draws one tier per roll', () => {
    expect(rollPack([0, 0, 0, 0, 0.999999])).toEqual(
      ['common', 'common', 'common', 'common', 'legendary'],
    );
  });

  it('affords a pack only with enough Drops', () => {
    expect(canAfford(250)).toBe(true);
    expect(canAfford(249)).toBe(false);
  });

  // §6: an exhausted tier downgrades and refunds, never hard-fails.
  it('refunds the difference when a pull downgrades a tier', () => {
    expect(refundFor('legendary', 'epic')).toBeGreaterThan(0);
    expect(refundFor('epic', 'common')).toBeGreaterThan(refundFor('epic', 'rare'));
    expect(refundFor('rare', 'rare')).toBe(0);
  });
});
