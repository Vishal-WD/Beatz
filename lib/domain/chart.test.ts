import { describe, it, expect } from 'vitest';
import { buildChart } from './chart';

const row = (id: string, rarity: 'common'|'rare'|'epic'|'legendary', total: number, left: number) => ({
  cardId: id, title: id, subtitle: 'X', rarity, artworkUrl: null,
  supplyTotal: total, supplyRemaining: left,
});

describe('world chart', () => {
  it('ranks the scarcest card first', () => {
    const chart = buildChart([row('a','common',1000,900), row('b','legendary',25,1)]);
    expect(chart[0].cardId).toBe('b');
    expect(chart[0].rank).toBe(1);
    expect(chart[1].rank).toBe(2);
  });

  it('reports scarcity as the fraction claimed', () => {
    const [e] = buildChart([row('a','rare',100,25)]);
    expect(e.scarcity).toBeCloseTo(0.75, 5);
  });

  it('never divides by zero on a card with no supply recorded', () => {
    const [e] = buildChart([row('a','rare',0,0)]);
    expect(Number.isFinite(e.scarcity)).toBe(true);
  });

  it('returns an empty chart for no rows, never placeholders', () => {
    expect(buildChart([])).toEqual([]);
  });

  it('honours the limit', () => {
    expect(buildChart([row('a','rare',10,1), row('b','rare',10,2), row('c','rare',10,3)], 2))
      .toHaveLength(2);
  });

  it('does not mutate the caller’s array', () => {
    const rows = [row('a','rare',10,5), row('b','epic',10,1)];
    const before = rows.map((r) => r.cardId).join(',');
    buildChart(rows);
    expect(rows.map((r) => r.cardId).join(',')).toBe(before);
  });
});
