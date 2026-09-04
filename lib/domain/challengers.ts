/**
 * The Challenger Line — who takes the throne when a contested reign ends.
 *
 * Positions are assigned by the database (an atomic increment, CLAUDE.md §6),
 * never by pushing onto an array; this module only reads and reorders what
 * the server already decided.
 */

import type { ControlModel } from './formats';
import { canDethrone } from './formats';

export interface Challenger {
  playerId: string;
  position: number;
}

const byPosition = (l: Challenger[]) => [...l].sort((x, y) => x.position - y.position);

/** Null in delegated and spectator rooms: nobody takes over (§1.2). */
export function nextHolder(line: Challenger[], control: ControlModel): string | null {
  if (!canDethrone(control)) return null;
  return byPosition(line)[0]?.playerId ?? null;
}

/** Front player takes the throne; everyone behind moves up one. */
export function advanceLine(line: Challenger[]): Challenger[] {
  return byPosition(line).slice(1).map((c, i) => ({ ...c, position: i + 1 }));
}

/**
 * Null when the player is not queued. The deck screen used to print a fixed
 * "Challenger #2" for everyone, which asserted a queue position nobody held.
 */
export function positionOf(line: Challenger[], playerId: string): number | null {
  return line.find((c) => c.playerId === playerId)?.position ?? null;
}
