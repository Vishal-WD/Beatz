import { describe, it, expect } from 'vitest';
import { FORMATS, controlModelFor, canDethrone, allowsShoutouts } from './formats';

describe('formats', () => {
  it('pins all six formats to a control model', () => {
    expect(Object.keys(FORMATS)).toHaveLength(6);
    expect(controlModelFor('disco')).toBe('contested');
    expect(controlModelFor('night_party')).toBe('delegated');
    expect(controlModelFor('concert')).toBe('spectator');
    expect(controlModelFor('clubbing')).toBe('spectator');
  });

  // CLAUDE.md §1.2: spectator vibe scores the set and cannot end one.
  it('only contested rooms can hand over the throne', () => {
    expect(canDethrone('contested')).toBe(true);
    expect(canDethrone('delegated')).toBe(false);
    expect(canDethrone('spectator')).toBe(false);
  });

  // Spec §4: shoutouts on Disco, Clubbing and Private Party only.
  it('allows shoutouts on exactly three formats', () => {
    const on = Object.values(FORMATS).filter((f) => f.shoutouts).map((f) => f.id);
    expect(on.sort()).toEqual(['clubbing', 'disco', 'private_party']);
    expect(allowsShoutouts('fest')).toBe(false);
  });

  // §1.1: visibility and card rule are independent axes.
  it('keeps visibility independent of the card rule', () => {
    expect(FORMATS.disco.visibility).toBe('open');
    expect(FORMATS.private_party.visibility).toBe('guest_list');
    expect(FORMATS.disco).not.toHaveProperty('mode');
  });
});
