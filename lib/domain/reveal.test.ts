import { describe, it, expect } from 'vitest';
import { viewFor, tapFrom, SEALED, TEARING, FLIPPING, PULLED } from './reveal';

/*
  The bug this pins.

  app/packs/page.tsx showed the shop counter when `stage === 0`. SEALED is
  also 0. So the sealed pack -- the un-torn frame the tear transition needs
  to animate FROM -- could never render: the picker owned that stage, and
  SealedPack first mounted at TEARING with the clip-path already applied.

  The tear was the best moment in the app and it had become a jump cut. The
  double-requestAnimationFrame written specifically to give the browser that
  first frame was doing its job against a state that was unreachable.

  Whether the shop is showing is now a separate flag. These tests hold the
  stages to meaning only what they say.
*/

describe('pack reveal stages', () => {
  it('renders the sealed pack UN-torn, so the tear has a frame to animate from', () => {
    const v = viewFor(SEALED);
    expect(v.packVisible).toBe(true);
    // The whole bug in one assertion.
    expect(v.torn).toBe(false);
    expect(v.cardOut).toBe(false);
  });

  it('tears and slides the card out together', () => {
    const v = viewFor(TEARING);
    expect(v.torn).toBe(true);
    expect(v.cardOut).toBe(true);
    // The bloom is held back for the flip; firing it here would spend the
    // reveal's payoff on its first frame.
    expect(v.spotlight).toBe(false);
  });

  it('blooms on the flip and keeps the pack until the card takes over', () => {
    expect(viewFor(FLIPPING).spotlight).toBe(true);
    expect(viewFor(FLIPPING).packVisible).toBe(true);
    expect(viewFor(PULLED).packVisible).toBe(false);
  });

  it('never shows a torn pack before the tear', () => {
    // Monotonic: once torn, always torn. A stage that un-tears would read as
    // the pack resealing itself mid-reveal.
    const seq = [SEALED, TEARING, FLIPPING, PULLED] as const;
    const torn = seq.map((s) => viewFor(s).torn);
    expect(torn).toEqual([false, true, true, true]);
  });
});

describe('tapping through a pack', () => {
  it('advances one stage at a time to PULLED', () => {
    expect(tapFrom(SEALED, 0, 5)).toBe(TEARING);
    expect(tapFrom(TEARING, 0, 5)).toBe(FLIPPING);
    expect(tapFrom(FLIPPING, 0, 5)).toBe(PULLED);
  });

  it('steps through every card before finishing', () => {
    // Five cards: four more taps after the first is revealed.
    for (let seen = 0; seen < 4; seen++) {
      expect(tapFrom(PULLED, seen, 5)).toBe('next-card');
    }
    expect(tapFrom(PULLED, 4, 5)).toBe('done');
  });

  it('finishes immediately on a single-card pack', () => {
    expect(tapFrom(PULLED, 0, 1)).toBe('done');
  });
});
