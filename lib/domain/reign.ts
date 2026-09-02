/**
 * Reign lifecycle: what the Vibe Bar means and when a reign ends.
 *
 * Pure and deterministic — time and crowd input arrive as arguments, so the
 * whole loop is testable without a browser, a socket or a clock. The
 * consequence of collapse is the ONE thing that varies by control model.
 */

import type { ControlModel } from './formats';
import { canDethrone } from './formats';

export const VIBE_MIN = 0;
export const VIBE_MAX = 100;
/** Below this a contested reign is over. */
export const COLLAPSE_THRESHOLD = 15;
/** A Peak Moment mints a Legendary (CLAUDE.md §3), so it must be rare. */
export const PEAK_MOMENT_VIBE = 100;

export type EndReason = 'collapsed' | 'skipped' | 'set_ended';

export interface ReignState {
  vibe: number;
  startedAt: number;
  peakVibe: number;
  peakMoments: number;
  endedReason: EndReason | null;
}

export function startReign(hype: number, now: number): ReignState {
  const vibe = clamp(hype);
  return { vibe, startedAt: now, peakVibe: vibe, peakMoments: 0, endedReason: null };
}

/**
 * Higher stamina decays more slowly. Kept gentle so a legendary reign is
 * long, not unlosable — an earlier build had drift outpacing decay entirely
 * and the throne never changed hands.
 */
function decayPerSecond(stamina: number): number {
  return 0.6 + (100 - clamp(stamina)) * 0.045;
}

export function tickReign(
  s: ReignState,
  opts: { control: ControlModel; stamina: number; crowdPull: number; deltaMs: number; now: number },
): ReignState {
  if (s.endedReason) return s;

  const seconds = opts.deltaMs / 1000;
  const next = clamp(s.vibe - decayPerSecond(opts.stamina) * seconds + opts.crowdPull * seconds);
  const peakVibe = Math.max(s.peakVibe, next);
  const peakMoments = s.peakMoments + (next >= PEAK_MOMENT_VIBE && s.vibe < PEAK_MOMENT_VIBE ? 1 : 0);

  // The whole point of the control model. Only a contested room takes the
  // throne away; a spectator set at vibe 0 is a weak set, not a forfeit.
  const endedReason: EndReason | null =
    canDethrone(opts.control) && next <= COLLAPSE_THRESHOLD ? 'collapsed' : null;

  return { ...s, vibe: next, peakVibe, peakMoments, endedReason };
}

export const isPeakMoment = (s: ReignState): boolean => s.vibe >= PEAK_MOMENT_VIBE;

const clamp = (n: number) => Math.max(VIBE_MIN, Math.min(VIBE_MAX, n));
