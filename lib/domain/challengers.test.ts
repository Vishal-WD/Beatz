import { describe, it, expect } from 'vitest';
import { nextHolder, advanceLine, positionOf } from './challengers';

const line = [
  { playerId: 'a', position: 1 },
  { playerId: 'b', position: 2 },
  { playerId: 'c', position: 3 },
];

describe('challenger line', () => {
  it('hands the throne to position 1 in a contested room', () => {
    expect(nextHolder(line, 'contested')).toBe('a');
  });

  // §1.2: nobody takes over in these models, so there is no next holder.
  it('has no next holder in delegated or spectator rooms', () => {
    expect(nextHolder(line, 'delegated')).toBeNull();
    expect(nextHolder(line, 'spectator')).toBeNull();
  });

  it('returns null for an empty line', () => {
    expect(nextHolder([], 'contested')).toBeNull();
  });

  it('closes the gap when the front takes the throne', () => {
    expect(advanceLine(line)).toEqual([
      { playerId: 'b', position: 1 },
      { playerId: 'c', position: 2 },
    ]);
  });

  it('reports a real position, never an invented one', () => {
    expect(positionOf(line, 'b')).toBe(2);
    expect(positionOf(line, 'zzz')).toBeNull();
  });

  it('orders by position, not array order', () => {
    const jumbled = [
      { playerId: 'c', position: 3 },
      { playerId: 'a', position: 1 },
    ];
    expect(nextHolder(jumbled, 'contested')).toBe('a');
  });
});
