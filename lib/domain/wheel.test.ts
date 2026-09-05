import { describe, it, expect } from 'vitest';
import {
  WHEEL, SPIN_COST, FREE_SPIN_MS,
  spin, segmentOdds, expectedValue, freeSpinIn, freeSpinReady, formatWait,
  landingAngle, segmentAt,
} from './wheel';

describe('wheel shape', () => {
  it('has seven segments', () => {
    expect(WHEEL).toHaveLength(7);
  });

  it('offers exactly the intended prizes', () => {
    const prizes = [...new Set(WHEEL.map((s) => s.value))].sort((a, b) => a - b);
    expect(prizes).toEqual([0, 50, 100, 250, 500, 1000]);
  });

  it('never places the two jackpots next to each other', () => {
    // Adjacent jackpots make a near-miss look rigged: the pointer sitting
    // between 500 and 1000 reads as a cheat rather than as luck.
    const big = WHEEL.map((s, i) => (s.value >= 500 ? i : -1)).filter((i) => i >= 0);
    for (const a of big) {
      for (const b of big) {
        if (a === b) continue;
        const gap = Math.abs(a - b);
        expect(Math.min(gap, WHEEL.length - gap)).toBeGreaterThan(1);
      }
    }
  });
});

describe('spin', () => {
  it('always returns a segment, for any roll in range', () => {
    for (let r = 0; r < 1; r += 0.001) {
      const { index, segment } = spin(r);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(WHEEL.length);
      expect(segment).toBe(WHEEL[index]);
    }
  });

  it('does not fall off the end at the boundaries', () => {
    // A roll of exactly 1 (or a float that rounds past the weight total)
    // must still land on a real segment rather than undefined.
    expect(spin(0).segment).toBe(WHEEL[0]);
    expect(spin(0.9999999999).segment).toBeDefined();
    expect(spin(1).segment).toBeDefined();
    expect(spin(-0.5).segment).toBe(WHEEL[0]);
  });

  it('reaches every segment', () => {
    const hit = new Set<number>();
    for (let r = 0; r < 1; r += 0.0001) hit.add(spin(r).index);
    expect(hit.size).toBe(WHEEL.length);
  });
});

describe('odds', () => {
  it('sums to one', () => {
    const total = segmentOdds().reduce((n, o) => n + o.chance, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps the top prizes genuinely rare', () => {
    const odds = segmentOdds();
    const chanceOf = (v: number) =>
      odds.filter((o) => o.value === v).reduce((n, o) => n + o.chance, 0);

    // 1000 is the jackpot: rarer than 1 in 200.
    expect(chanceOf(1000)).toBeLessThan(0.005);
    // 500 is scarce but not mythical.
    expect(chanceOf(500)).toBeLessThan(0.03);
    expect(chanceOf(500)).toBeGreaterThan(chanceOf(1000));
    // The blank is common enough to make a win feel like one.
    expect(chanceOf(0)).toBeGreaterThan(0.2);
  });

  /*
    The economy guard. CLAUDE.md §3 keeps Drops earn-only and finite in
    feel; a wheel whose average payout beat its cost would be an infinite
    Drops printer and the shop would stop meaning anything. This is the
    check that catches a weight edited in isolation.
  */
  it('pays out less than it costs, on average', () => {
    expect(expectedValue()).toBeLessThan(SPIN_COST);
  });

  it('still pays enough to be worth spinning', () => {
    // Too punishing and nobody spins twice; the free hourly spin has to
    // feel like a gift, not a formality.
    expect(expectedValue()).toBeGreaterThan(SPIN_COST * 0.7);
  });

  it('has fixed odds that cannot vary by player or spend (CLAUDE.md §3)', () => {
    // The rejected pattern is a curve that improves with engagement. spin()
    // takes only a roll, so there is nowhere for playtime to enter.
    expect(spin.length).toBe(1);
    const a = segmentOdds();
    const b = segmentOdds();
    expect(a).toEqual(b);
  });
});

describe('free spin timing', () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);

  it('is ready when the player has never spun', () => {
    expect(freeSpinReady(null, now)).toBe(true);
    expect(freeSpinIn(null, now)).toBe(0);
  });

  it('is not ready immediately after a spin', () => {
    const justNow = new Date(now - 1000).toISOString();
    expect(freeSpinReady(justNow, now)).toBe(false);
    expect(freeSpinIn(justNow, now)).toBeGreaterThan(0);
  });

  it('is ready again after an hour', () => {
    const anHourAgo = new Date(now - FREE_SPIN_MS).toISOString();
    expect(freeSpinReady(anHourAgo, now)).toBe(true);
  });

  it('is still not ready one second short of the hour', () => {
    const almost = new Date(now - FREE_SPIN_MS + 1000).toISOString();
    expect(freeSpinReady(almost, now)).toBe(false);
  });

  it('does not lock the player out if the clock jumped backwards', () => {
    // A device whose time moved back would otherwise report hours of wait.
    const future = new Date(now + 5 * FREE_SPIN_MS).toISOString();
    expect(freeSpinReady(future, now)).toBe(true);
  });
});

describe('formatWait', () => {
  it('reads as a wait, not a number', () => {
    expect(formatWait(0)).toBe('ready');
    expect(formatWait(30_000)).toBe('less than a minute');
    expect(formatWait(8 * 60_000)).toBe('8m');
    expect(formatWait(FREE_SPIN_MS)).toBe('1h');
  });
});

describe('landingAngle', () => {
  it('puts the winning segment under the pointer', () => {
    for (let i = 0; i < WHEEL.length; i++) {
      expect(segmentAt(landingAngle(i, 0))).toBe(i);
    }
  });

  /*
    The bug this pins: the angle was computed as a DELTA and added to the
    wheel's current rotation. That is correct exactly once. After the wheel
    has turned, adding an absolute landing position lands somewhere else —
    so spin one was right and every spin after it drifted, leaving the
    pointer on a different prize than the one the server had paid out.
  */
  it('stays correct across many consecutive spins', () => {
    let angle = 0;
    for (const idx of [3, 3, 5, 1, 0, 6, 6, 2, 4]) {
      angle = landingAngle(idx, angle);
      expect(segmentAt(angle)).toBe(idx);
    }
  });

  it('always turns forwards, by at least the requested turns', () => {
    let angle = 0;
    for (const idx of [6, 0, 6, 0]) {
      const next = landingAngle(idx, angle, 5);
      expect(next).toBeGreaterThanOrEqual(angle + 5 * 360);
      angle = next;
    }
  });
});

/*
  The free spin must not be offered twice.

  The wheel read `lastFreeSpinAt` from the cached profile, which does not
  change until refreshProfile() has round-tripped. In that gap the button
  still said SPIN FREE, so a second tap looked free and silently spent 100
  Drops -- the server correctly refuses a second free spin inside the hour
  and falls back to the paid path.

  The server's own answer now wins over the cache until the cache catches
  up. These pin the arithmetic that decision rests on.
*/
describe('the free spin is once an hour, not once a render', () => {
  it('is not ready the instant one is taken', () => {
    const justNow = new Date().toISOString();
    expect(freeSpinReady(justNow, Date.now())).toBe(false);
  });

  it('counts down a full hour from the spin', () => {
    const t0 = Date.parse('2026-09-05T12:00:00Z');
    const spun = new Date(t0).toISOString();

    expect(freeSpinReady(spun, t0 + 59 * 60_000)).toBe(false);
    expect(freeSpinReady(spun, t0 + 60 * 60_000)).toBe(true);
  });

  it('reports the remaining wait so the button can say it', () => {
    const t0 = Date.parse('2026-09-05T12:00:00Z');
    const spun = new Date(t0).toISOString();
    // Half an hour in, half an hour left.
    expect(freeSpinIn(spun, t0 + 30 * 60_000)).toBe(30 * 60_000);
    expect(formatWait(freeSpinIn(spun, t0 + 30 * 60_000))).toBe('30m');
  });

  it('treats a server timestamp newer than the cached one as authoritative', () => {
    /*
      What the component does: the cached profile still holds the OLD spin
      time while the server has already recorded a newer one. Taking the
      later of the two is what stops the button offering a spin the server
      will refuse.
    */
    const older = '2026-09-05T12:00:00.000Z';
    const newer = '2026-09-05T12:30:00.000Z';
    const effective = newer > older ? newer : older;

    // Past the hour for the older stamp, still inside it for the newer.
    const at = Date.parse('2026-09-05T13:05:00Z');
    expect(freeSpinReady(older, at)).toBe(true);      // the stale view
    expect(freeSpinReady(effective, at)).toBe(false); // what the player sees
  });
});
