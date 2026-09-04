import { describe, it, expect } from 'vitest';
import {
  usesMic, micModesFor, winningNomination, stepInPasses, stepInThreshold,
  type Nomination, type MicPerson,
} from './mic';

const people = (...ids: string[]): MicPerson[] =>
  ids.map((id) => ({ playerId: id, displayName: id.toUpperCase() }));

const nom = (id: string, playerId: string, cardId: string, votes: string[]): Nomination =>
  ({ id, playerId, cardId, votes });

describe('mic modes', () => {
  // Spec §2.1: Concert and Fest pick a mode at creation. Clubbing has one
  // invited DJ and never votes. The contested and delegated formats have no
  // mic concept at all.
  it('uses a mic only in Concert and Fest', () => {
    expect(usesMic('concert')).toBe(true);
    expect(usesMic('fest')).toBe(true);
    expect(usesMic('clubbing')).toBe(false);
    expect(usesMic('night_party')).toBe(false);
    expect(usesMic('disco')).toBe(false);
    expect(usesMic('private_party')).toBe(false);
  });

  it('offers all three modes to the formats that use a mic', () => {
    expect(micModesFor('concert')).toEqual(['solo', 'vote_song', 'setlist']);
    expect(micModesFor('fest')).toEqual(['solo', 'vote_song', 'setlist']);
  });

  it('offers no modes to a format without a mic', () => {
    expect(micModesFor('clubbing')).toEqual([]);
    expect(micModesFor('disco')).toEqual([]);
  });
});

describe('winningNomination', () => {
  it('returns the nomination with the most votes', () => {
    const out = winningNomination([
      nom('n1', 'a', 'c1', ['a']),
      nom('n2', 'b', 'c2', ['b', 'c']),
    ]);
    expect(out?.id).toBe('n2');
  });

  it('returns null when nothing is nominated', () => {
    expect(winningNomination([])).toBeNull();
  });

  it('returns null when every nomination has zero votes', () => {
    expect(winningNomination([nom('n1', 'a', 'c1', []), nom('n2', 'b', 'c2', [])]))
      .toBeNull();
  });

  // A tie must be broken deterministically, or two clients reading the same
  // rows would disagree about what plays next.
  it('breaks a tie on nomination id, so every client agrees', () => {
    const a = winningNomination([
      nom('n2', 'b', 'c2', ['x']),
      nom('n1', 'a', 'c1', ['y']),
    ]);
    const b = winningNomination([
      nom('n1', 'a', 'c1', ['y']),
      nom('n2', 'b', 'c2', ['x']),
    ]);
    expect(a?.id).toBe('n1');
    expect(b?.id).toBe('n1');
  });

  it('counts a duplicate vote from the same player only once', () => {
    const out = winningNomination([
      nom('n1', 'a', 'c1', ['x', 'x', 'x']),
      nom('n2', 'b', 'c2', ['y', 'z']),
    ]);
    expect(out?.id).toBe('n2');
  });
});

describe('stepInPasses', () => {
  const mics = people('holder', 'a', 'b', 'c');

  // "the other mic people vote" — the holder is not one of them, so the
  // majority is of the OTHERS, not of everyone.
  it('passes on a majority of the other mic people', () => {
    expect(stepInPasses(['a', 'b'], mics, 'holder')).toBe(true);
  });

  it('fails without a majority', () => {
    expect(stepInPasses(['a'], mics, 'holder')).toBe(false);
  });

  it('ignores a vote from the current holder', () => {
    // holder + a is 2 raw votes, but the holder cannot vote itself out, so
    // this is really 1 of 3 others.
    expect(stepInPasses(['holder', 'a'], mics, 'holder')).toBe(false);
  });

  it('ignores a vote from someone who is not a mic person', () => {
    expect(stepInPasses(['a', 'b', 'stranger'], mics, 'holder')).toBe(true);
    expect(stepInPasses(['a', 'stranger'], mics, 'holder')).toBe(false);
  });

  it('cannot pass when the holder is the only mic person', () => {
    expect(stepInPasses([], people('holder'), 'holder')).toBe(false);
    expect(stepInPasses(['holder'], people('holder'), 'holder')).toBe(false);
  });
});

describe('stepInThreshold', () => {
  /*
    The panel shows "2 OF 3 NEEDED" so a request in progress does not read
    as broken. That count has to mean the same thing stepInPasses decides,
    or the room watches a counter hit its target and nothing happen.

    Rather than assert a handful of hand-picked numbers, walk every room
    size and check the threshold is EXACTLY the point where stepInPasses
    flips: one vote short must fail, and the threshold itself must pass.
  */
  it('is exactly the vote count at which a step in starts passing', () => {
    for (let others = 1; others <= 8; others++) {
      const names = Array.from({ length: others }, (_, i) => `p${i}`);
      const mics = people('holder', ...names);
      const need = stepInThreshold(mics, 'holder');

      expect(stepInPasses(names.slice(0, need), mics, 'holder')).toBe(true);
      expect(stepInPasses(names.slice(0, need - 1), mics, 'holder')).toBe(false);
    }
  });

  it('ignores the holder when counting, as the rule does', () => {
    // Four mic people, one holding: the vote is of the three others, so a
    // majority is 2 — not 3, which counting all four would give.
    expect(stepInThreshold(people('holder', 'a', 'b', 'c'), 'holder')).toBe(2);
  });
});
