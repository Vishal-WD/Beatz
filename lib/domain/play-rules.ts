/**
 * May this player play this card right now?
 *
 * One function, so the answer cannot drift between the deck screen, the
 * server handler and the room view. Returns a reason rather than a bare
 * false — the UI has to tell the player why, not just refuse.
 */

import type { CardRule, FormatId } from './formats';
import { controlModelFor } from './formats';

export type PlayRefusal =
  | 'not_your_turn'
  | 'guest_card_in_event_room'
  | 'not_owned'
  | 'crowd_cannot_play';

export interface PlayContext {
  format: FormatId;
  cardRule: CardRule;
  isHost: boolean;
  isHolder: boolean;
  isGuestCard: boolean;
  owned: boolean;
}

export function canPlayCard(ctx: PlayContext): { ok: true } | { ok: false; reason: PlayRefusal } {
  // CLAUDE.md §4: the only place room mode is allowed to branch logic.
  if (ctx.cardRule === 'event' && ctx.isGuestCard) {
    return { ok: false, reason: 'guest_card_in_event_room' };
  }

  // Guest Cards are never owned and never enter the scarce pool (§2), so
  // the ownership check applies only to real cards.
  if (!ctx.isGuestCard && !ctx.owned) {
    return { ok: false, reason: 'not_owned' };
  }

  // In spectator and delegated rooms only the host/DJ puts cards on the
  // deck; the crowd sustains or offers, but never plays (§1.1).
  if (controlModelFor(ctx.format) !== 'contested' && !ctx.isHost) {
    return { ok: false, reason: 'crowd_cannot_play' };
  }

  return { ok: true };
}
