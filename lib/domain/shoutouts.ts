/**
 * Shoutouts — card credit on the formats that allow it.
 *
 * Gives the collectible layer a social payoff it currently lacks: today a
 * rare card is only better stats, and nobody in the room learns whose
 * collection it came from.
 *
 * Display only. CLAUDE.md §1.2 is explicit: a shoutout awards no Drops,
 * changes no odds and confers no mechanical advantage. If it paid out,
 * social standing would become a second progression track, which is exactly
 * what §3 exists to prevent. So this module returns a STRING and nothing
 * else — it has no access to Drops, supply or odds by construction, which
 * makes the rule structural rather than a convention someone can forget.
 */

import type { FormatId } from './formats';
import { allowsShoutouts } from './formats';

export interface CardCredit {
  ownerHandle: string;
  ownerName: string;
}

/**
 * Null on formats without shoutouts (Concert, Fest, Night Party) and null
 * when the card's owner is unknown — never a placeholder name.
 */
export function creditFor(format: FormatId, credit: CardCredit | null): string | null {
  if (!allowsShoutouts(format) || !credit) return null;
  return `from @${credit.ownerHandle}'s collection`;
}
