import { describe, it, expect } from 'vitest';
import { canPlayCard, type PlayContext } from './play-rules';

const ctx = (over: Partial<PlayContext> = {}): PlayContext => ({
  format: 'disco', cardRule: 'casual', isHost: false,
  isGuestCard: false, owned: true, ...over,
});

describe('card play rules', () => {
  it('lets anyone play in a contested room', () => {
    expect(canPlayCard(ctx())).toEqual({ ok: true });
  });

  // CLAUDE.md §4: the ONE place room mode branches logic.
  it('blocks Guest Cards in an event room', () => {
    expect(canPlayCard(ctx({ cardRule: 'event', isGuestCard: true })))
      .toEqual({ ok: false, reason: 'guest_card_in_event_room' });
  });

  it('allows Guest Cards in a casual room', () => {
    expect(canPlayCard(ctx({ cardRule: 'casual', isGuestCard: true }))).toEqual({ ok: true });
  });

  it('refuses a card the player does not own', () => {
    expect(canPlayCard(ctx({ owned: false })))
      .toEqual({ ok: false, reason: 'not_owned' });
  });

  // A Guest Card is never owned; the ownership check must not fire on it.
  it('does not demand ownership of a Guest Card', () => {
    expect(canPlayCard(ctx({ isGuestCard: true, owned: false }))).toEqual({ ok: true });
  });

  it('only lets hosts play in a spectator room', () => {
    expect(canPlayCard(ctx({ format: 'concert', isHost: true }))).toEqual({ ok: true });
    expect(canPlayCard(ctx({ format: 'concert', isHost: false })))
      .toEqual({ ok: false, reason: 'crowd_cannot_play' });
  });

  it('only lets the DJ play in a delegated room', () => {
    expect(canPlayCard(ctx({ format: 'night_party', isHost: true }))).toEqual({ ok: true });
    expect(canPlayCard(ctx({ format: 'night_party', isHost: false })))
      .toEqual({ ok: false, reason: 'crowd_cannot_play' });
  });
});
