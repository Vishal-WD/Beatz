/**
 * Seeded social data — Events, RSVPs, following, activity feed.
 *
 * Adopted by explicit override of CLAUDE.md §1 (see §1.1). Guard rails:
 * an Event always resolves into a room running the normal core loop, and
 * nothing here affects rarity, pull odds, or supply.
 *
 * Event poster art is ORIGINAL (gradients + type), never album art —
 * event artwork is one of the few asset classes safe to originate
 * (docs/CARD_ART_GENERATION.md §6).
 */

import type { PartyEvent, SocialProfile, EventKind } from '@/types/social';
import { avatarFor } from './rarity';

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

interface HostSeed {
  id: string;
  name: string;
  initials: string;
  handle: string;
  followers: number;
  verified: boolean;
}

const HOSTS: HostSeed[] = [
  { id: 'u-maya', name: 'Maya J.', initials: 'MJ', handle: '@mayaj', followers: 2841, verified: true },
  { id: 'u-dom', name: 'Dom R.', initials: 'DR', handle: '@domr', followers: 1204, verified: false },
  { id: 'u-sasha', name: 'Sasha V.', initials: 'SV', handle: '@sashav', followers: 5630, verified: true },
  { id: 'u-eli', name: 'Eli T.', initials: 'ET', handle: '@elit', followers: 612, verified: false },
];

const host = (h: HostSeed) => ({
  userId: h.id,
  displayName: h.name,
  initials: h.initials,
  avatarGradient: avatarFor(h.id),
  followerCount: h.followers,
  isVerified: h.verified,
});

/** Original poster treatments — one per event kind, no album art reused. */
const POSTERS: Record<EventKind, { gradient: string; accent: string }> = {
  disco: { gradient: 'linear-gradient(140deg,#ff2e88,#7b2bff 60%,#1a0a2e)', accent: '#ff2e88' },
  dj_night: { gradient: 'linear-gradient(140deg,#4ce3ff,#7b2bff 55%,#0a1030)', accent: '#4ce3ff' },
  house_party: { gradient: 'linear-gradient(140deg,#ffd84d,#ff6b2e 55%,#2e1000)', accent: '#ffd84d' },
  listening: { gradient: 'linear-gradient(140deg,#7dffc3,#1a6b5a 60%,#04201a)', accent: '#7dffc3' },
  tournament: { gradient: 'linear-gradient(140deg,#ff2e88,#ffd84d 45%,#4ce3ff)', accent: '#ffd84d' },
};

interface EventSeed {
  slug: string;
  kind: EventKind;
  title: string;
  tagline: string;
  hostIdx: number;
  inHours: number;
  status: PartyEvent['status'];
  venue: string;
  hint: string | null;
  online: boolean;
  mode: 'casual' | 'event';
  capacity: number | null;
  going: number;
  interested: number;
  rsvp: PartyEvent['viewerRsvp'];
  tags: string[];
}

const EVENT_SEEDS: EventSeed[] = [
  {
    slug: 'basement-4am',
    kind: 'disco',
    title: 'Basement 4AM',
    tagline: 'No requests. Only cards.',
    hostIdx: 0,
    inHours: -0.4, // already started
    status: 'live',
    venue: 'The Basement',
    hint: 'Ring the second buzzer',
    online: false,
    mode: 'event',
    capacity: 60,
    going: 47,
    interested: 112,
    rsvp: 'going',
    tags: ['DISCO', 'HOUSE', 'NO LAPTOPS'],
  },
  {
    slug: 'chrome-rodeo-night',
    kind: 'dj_night',
    title: 'Chrome Rodeo',
    tagline: 'Four decks. One throne.',
    hostIdx: 2,
    inHours: 5,
    status: 'scheduled',
    venue: 'Tall Boy West',
    hint: null,
    online: false,
    mode: 'event',
    capacity: 120,
    going: 88,
    interested: 240,
    rsvp: 'interested',
    tags: ['TECHNO', 'BIG ROOM'],
  },
  {
    slug: 'sunday-listening',
    kind: 'listening',
    title: 'Sunday Listening',
    tagline: 'Deep cuts only. Bring stamina.',
    hostIdx: 1,
    inHours: 29,
    status: 'scheduled',
    venue: 'Online',
    hint: null,
    online: true,
    mode: 'casual',
    capacity: null,
    going: 34,
    interested: 61,
    rsvp: null,
    tags: ['AMBIENT', 'DEEP CUTS'],
  },
  {
    slug: 'aux-open-series-01',
    kind: 'tournament',
    title: 'Aux Open · Series 01',
    tagline: 'Bracket play. Owned cards only.',
    hostIdx: 2,
    inHours: 76,
    status: 'scheduled',
    venue: 'Moth Club',
    hint: 'Doors 21:00',
    online: false,
    mode: 'event',
    capacity: 32,
    going: 32,
    interested: 410,
    rsvp: 'going',
    tags: ['TOURNAMENT', 'RANKED'],
  },
  {
    slug: 'six-floors-housewarming',
    kind: 'house_party',
    title: 'Six Floors Up',
    tagline: 'Housewarming. Guest cards welcome.',
    hostIdx: 3,
    inHours: 51,
    status: 'scheduled',
    venue: 'Flat 12',
    hint: 'Buzzer broken, text on arrival',
    online: false,
    mode: 'casual',
    capacity: 25,
    going: 19,
    interested: 33,
    rsvp: null,
    tags: ['ANYTHING GOES'],
  },
];

export const EVENTS: PartyEvent[] = EVENT_SEEDS.map((e, i) => ({
  id: `e-${i}`,
  slug: e.slug,
  kind: e.kind,
  title: e.title,
  tagline: e.tagline,
  host: host(HOSTS[e.hostIdx]),
  posterGradient: POSTERS[e.kind].gradient,
  posterAccent: POSTERS[e.kind].accent,
  startsAt: hoursFromNow(e.inHours),
  endsAt: null,
  status: e.status,
  venueName: e.venue,
  venueHint: e.hint,
  isOnline: e.online,
  roomId: e.slug,
  roomMode: e.mode,
  capacity: e.capacity,
  goingCount: e.going,
  interestedCount: e.interested,
  viewerRsvp: e.rsvp,
  genreTags: e.tags,
  createdAt: hoursFromNow(-72),
}));

export const eventBySlug = (slug: string): PartyEvent | undefined =>
  EVENTS.find((e) => e.slug === slug);

export const SUGGESTED_PROFILES: SocialProfile[] = HOSTS.map((h, i) => ({
  userId: h.id,
  displayName: h.name,
  handle: h.handle,
  initials: h.initials,
  avatarGradient: avatarFor(h.id),
  bio: [
    'Holds the aux, rarely gives it back.',
    'Deep cuts and long reigns.',
    'Three-time Aux Open finalist.',
    'Will play the obvious song unironically.',
  ][i],
  tier: ['AUX MARSHAL', 'CHALLENGER', 'AUX MARSHAL', 'ROOKIE'][i],
  followerCount: h.followers,
  followingCount: [312, 508, 190, 244][i],
  eventsHosted: [14, 6, 31, 2][i],
  viewerFollows: [true, false, true, false][i],
  totalReignsWon: [37, 12, 64, 4][i],
  peakVibe: [99, 81, 97, 62][i],
  challengerWinRate: [0.61, 0.44, 0.72, 0.28][i],
}));

/** "in 5h", "in 3d", "live now" — events are read at a glance. */
export function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60_000);
  if (mins < -1) return 'live now';
  if (mins < 60) return `in ${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.round(hrs / 24)}d`;
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}
