/**
 * The Drops wheel.
 *
 * One free spin an hour, or 100 Drops to spin again. Seven segments.
 *
 * Two constraints from CLAUDE.md this deliberately respects:
 *
 *  - §3 keeps Drops EARN-ONLY. The paid spin costs Drops and pays Drops, so
 *    it is a sink and a faucet inside the existing currency, never a
 *    real-money path. Nothing here can be bought.
 *  - §3 also forbids odds that improve with playtime or spend. These weights
 *    are fixed constants. A player who has spun a thousand times has exactly
 *    the same chance as one who has never spun — the rejected pattern is a
 *    curve that rewards engagement, and a flat table is not that.
 *
 * The expected value is deliberately BELOW the 100-Drop cost, so paid
 * spinning is a gamble the house wins on average. If it were above, the
 * wheel would be an infinite Drops printer and the shop would stop meaning
 * anything.
 */

export interface WheelSegment {
  /** Drops paid out. 0 is the blank. */
  readonly value: number;
  readonly label: string;
  /** Relative weight. Not a percentage — see `segmentOdds`. */
  readonly weight: number;
}

/**
 * Seven segments, ordered as they sit on the wheel.
 *
 * The big prizes are placed apart rather than adjacent: a wheel whose two
 * jackpots touch looks rigged when the pointer lands between them, and the
 * near-miss reads as a cheat rather than luck.
 */
export const WHEEL: readonly WheelSegment[] = [
  { value: 50, label: '50', weight: 2600 },
  { value: 500, label: '500', weight: 260 },
  { value: 100, label: '100', weight: 2400 },
  { value: 0, label: 'BETTER LUCK', weight: 3300 },
  { value: 250, label: '250', weight: 1400 },
  { value: 1000, label: '1000', weight: 40 },
  { value: 100, label: '100', weight: 2400 },
] as const;

/** What a paid spin costs. The free hourly spin costs nothing. */
export const SPIN_COST = 100;

/** How long between free spins. */
export const FREE_SPIN_MS = 60 * 60 * 1000;

const TOTAL_WEIGHT = WHEEL.reduce((n, s) => n + s.weight, 0);

/**
 * Picks a segment from a roll in [0, 1).
 *
 * Taking the roll as an argument rather than calling Math.random() inside
 * keeps this testable: the odds can be asserted exactly instead of
 * approximately over a sample.
 */
export function spin(roll: number): { index: number; segment: WheelSegment } {
  // A roll of exactly 1, or a float that rounds past the total, must not
  // fall off the end of the table.
  const target = Math.min(Math.max(roll, 0), 0.999999) * TOTAL_WEIGHT;
  let seen = 0;
  for (let i = 0; i < WHEEL.length; i++) {
    seen += WHEEL[i].weight;
    if (target < seen) return { index: i, segment: WHEEL[i] };
  }
  const last = WHEEL.length - 1;
  return { index: last, segment: WHEEL[last] };
}

/** Each segment's true probability, for display and for tests. */
export function segmentOdds(): { label: string; value: number; chance: number }[] {
  return WHEEL.map((s) => ({
    label: s.label,
    value: s.value,
    chance: s.weight / TOTAL_WEIGHT,
  }));
}

/**
 * Average payout per spin.
 *
 * Must stay under SPIN_COST or the wheel prints Drops forever. A test pins
 * this, because a weight edited in isolation would otherwise flip the
 * economy quietly.
 */
export function expectedValue(): number {
  return WHEEL.reduce((n, s) => n + (s.value * s.weight) / TOTAL_WEIGHT, 0);
}

/** Milliseconds until the next free spin, 0 when one is ready. */
export function freeSpinIn(lastFreeSpinAt: string | null, now = Date.now()): number {
  if (!lastFreeSpinAt) return 0;
  const elapsed = now - new Date(lastFreeSpinAt).getTime();
  // A clock that jumped backwards must not lock the player out for hours.
  if (elapsed < 0) return 0;
  return Math.max(0, FREE_SPIN_MS - elapsed);
}

export const freeSpinReady = (lastFreeSpinAt: string | null, now = Date.now()): boolean =>
  freeSpinIn(lastFreeSpinAt, now) === 0;

/** "42m" / "8m" / "less than a minute" — for the waiting state. */
export function formatWait(ms: number): string {
  if (ms <= 0) return 'ready';
  const mins = Math.ceil(ms / 60000);
  if (mins >= 60) return '1h';
  if (mins <= 1) return 'less than a minute';
  return `${mins}m`;
}

/**
 * The absolute rotation that puts segment `index` under the top pointer.
 *
 * This is deliberately ABSOLUTE, not a delta. The first version added
 * `360*5 + (360 - segmentCentre)` to the wheel's current angle, which is
 * correct exactly once: after the wheel has turned, adding an absolute
 * landing position to an already-rotated wheel lands somewhere else. Spin
 * one was right and every spin after it drifted, so the pointer disagreed
 * with the prize the server had already paid.
 *
 * `from` is the current angle, used only to guarantee the wheel turns
 * FORWARDS by at least `turns` full rotations — otherwise a landing that
 * happens to sit behind the current position would spin backwards.
 */
export function landingAngle(index: number, from: number, turns = 5): number {
  const seg = 360 / WHEEL.length;
  // Where the wheel must end up, modulo a full turn.
  const settle = (360 - (index * seg + seg / 2) + 360) % 360;
  const base = Math.floor(from / 360) * 360;
  let target = base + settle;
  // Always move forward, and always by a visible number of turns.
  while (target < from + turns * 360) target += 360;
  return target;
}

/**
 * Which segment sits under the pointer at `angle`. The inverse of the above,
 * and the thing that makes landingAngle testable rather than eyeballed.
 *
 * Rounds against the segment CENTRE rather than flooring into a slice: a
 * landing puts a centre exactly under the pointer, and flooring a value
 * sitting precisely on a boundary picks the neighbour.
 */
export function segmentAt(angle: number): number {
  const seg = 360 / WHEEL.length;
  const norm = ((angle % 360) + 360) % 360;
  const centre = ((360 - norm) % 360 + 360) % 360;
  return Math.round((centre - seg / 2) / seg) % WHEEL.length;
}
