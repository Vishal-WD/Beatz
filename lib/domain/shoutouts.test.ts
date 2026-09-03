import { describe, it, expect } from 'vitest';
import { creditFor } from './shoutouts';

const credit = { ownerHandle: 'sashav', ownerName: 'Sasha V.' };

describe('shoutouts', () => {
  // Spec §4: Disco, Clubbing and Private Party only.
  it('credits the card owner on the three formats that allow it', () => {
    expect(creditFor('disco', credit)).toContain('@sashav');
    expect(creditFor('clubbing', credit)).toContain('@sashav');
    expect(creditFor('private_party', credit)).toContain('@sashav');
  });

  it('shows nothing on formats without shoutouts', () => {
    expect(creditFor('concert', credit)).toBeNull();
    expect(creditFor('fest', credit)).toBeNull();
    expect(creditFor('night_party', credit)).toBeNull();
  });

  it('shows nothing when the card has no known owner', () => {
    expect(creditFor('disco', null)).toBeNull();
  });

  // CLAUDE.md §1.2: display only. A shoutout that paid out would make social
  // standing a second progression track, which §3 exists to prevent. The
  // module returns a string and has no other output by construction.
  it('returns only a string — never a reward of any kind', () => {
    const out = creditFor('disco', credit);
    expect(typeof out).toBe('string');
  });
});
