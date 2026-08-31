/**
 * Social layer — Events, RSVPs, following, activity feed.
 *
 * Adopted by explicit override of CLAUDE.md §1 (see §1.1, decided
 * 2026-08-31). The guard rails in §1.1 still bind:
 *   - an Event resolves into a room running the normal core loop
 *   - social standing NEVER affects rarity, pull odds, or supply
 *   - Drops stay earn-only; nothing here is ever sold
 */

import type { RoomMode } from './game';

export type EventKind = 'disco' | 'dj_night' | 'house_party' | 'listening' | 'tournament';
export type EventStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type RsvpState = 'going' | 'interested' | 'declined';

export interface EventHost {
  userId: string;
  displayName: string;
  initials: string;
  avatarGradient: string;
  /** Denormalized for list rendering; authoritative count lives on the profile. */
  followerCount: number;
  isVerified: boolean;
}

export interface PartyEvent {
  id: string;
  slug: string;
  kind: EventKind;
  title: string;
  tagline: string | null;
  host: EventHost;

  /**
   * Original artwork only. Event art is one of the few asset classes safe to
   * originate (CARD_ART_GENERATION.md §6) — it involves no artist likeness
   * and no copyrighted cover. Never reuse album art as event art.
   */
  posterGradient: string;
  posterAccent: string;

  startsAt: string;
  endsAt: string | null;
  status: EventStatus;

  venueName: string;
  /** Free-text, deliberately vague ("Basement, 4AM") — no precise addresses. */
  venueHint: string | null;
  isOnline: boolean;

  /** The room this event opens into. Event Rooms block Guest Cards (§4). */
  roomId: string;
  roomMode: RoomMode;

  capacity: number | null;
  goingCount: number;
  interestedCount: number;
  /** Whether the viewer's own RSVP exists, and in what state. */
  viewerRsvp: RsvpState | null;

  genreTags: string[];
  createdAt: string;
}

export interface Rsvp {
  eventId: string;
  userId: string;
  state: RsvpState;
  createdAt: string;
  /**
   * RSVP reserves a Challenger Line slot when the room opens. This is the
   * bridge back to the core loop — an RSVP is not a standalone reward.
   */
  reservesChallengerSlot: boolean;
}

export interface SocialProfile {
  userId: string;
  displayName: string;
  handle: string;
  initials: string;
  avatarGradient: string;
  bio: string | null;
  tier: string;

  followerCount: number;
  followingCount: number;
  eventsHosted: number;
  /** Viewer-relative; null when viewing your own profile. */
  viewerFollows: boolean | null;

  totalReignsWon: number;
  peakVibe: number;
  challengerWinRate: number;
}

export type ActivityKind =
  | 'event_created'
  | 'event_live'
  | 'reign_won'
  | 'peak_moment'
  | 'card_pulled'
  | 'started_following';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  actor: { userId: string; displayName: string; initials: string; avatarGradient: string };
  createdAt: string;
  /** Rendered per-kind; keeps the feed one type instead of a union explosion. */
  subject: string;
  detail: string | null;
  /** Deep link target — every feed item routes back into the app. */
  href: string | null;
  accent: string | null;
}

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  disco: 'DISCO',
  dj_night: 'DJ NIGHT',
  house_party: 'HOUSE PARTY',
  listening: 'LISTENING',
  tournament: 'TOURNAMENT',
};
