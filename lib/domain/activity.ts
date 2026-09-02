/**
 * The activity feed, derived from things that actually happened.
 *
 * It used to be a hand-written ACTIVITY[] array in lib/social-data.ts, so it
 * said the same thing forever and never reflected a real reign, pull or
 * follow. Every entry here traces back to a database row.
 */

export type ActivityKind = 'reign_won' | 'peak_moment' | 'card_pulled' | 'followed' | 'rsvp';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actorName: string;
  subject: string;
  detail: string | null;
  createdAt: string;
}

export interface ReignRow  { id: string; playerName: string; cardTitle: string; peakVibe: number; endedAt: string }
export interface PullRow   { id: string; playerName: string; cardTitle: string; rarity: string; acquiredAt: string }
export interface FollowRow { id: string; followerName: string; followeeName: string; createdAt: string }

export interface FeedSources {
  reigns: ReignRow[];
  pulls: PullRow[];
  follows: FollowRow[];
}

export function buildFeed(src: FeedSources, limit = 50): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...src.reigns.map((r) => ({
      id: r.id,
      // A Peak Moment mints a Legendary (§3), so it reads differently.
      kind: (r.peakVibe >= 100 ? 'peak_moment' : 'reign_won') as ActivityKind,
      actorName: r.playerName,
      subject: `held the throne with ${r.cardTitle}`,
      detail: `PEAK ${r.peakVibe}`,
      createdAt: r.endedAt,
    })),
    ...src.pulls.map((p) => ({
      id: p.id,
      kind: 'card_pulled' as ActivityKind,
      actorName: p.playerName,
      subject: `pulled ${p.cardTitle}`,
      detail: p.rarity.toUpperCase(),
      createdAt: p.acquiredAt,
    })),
    ...src.follows.map((f) => ({
      id: f.id,
      kind: 'followed' as ActivityKind,
      actorName: f.followerName,
      subject: `followed ${f.followeeName}`,
      detail: null,
      createdAt: f.createdAt,
    })),
  ];

  return events
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);
}
