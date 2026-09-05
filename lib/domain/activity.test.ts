import { describe, it, expect } from 'vitest';
import { buildFeed, KIND_ACCENT } from './activity';

const src = {
  reigns: [{ id: 'r1', playerName: 'Rae K.', cardTitle: 'Naatu Naatu', peakVibe: 97, endedAt: '2026-09-02T10:00:00Z' }],
  pulls:  [{ id: 'p1', playerName: 'Eli T.', cardTitle: 'Blinding Lights', rarity: 'legendary', acquiredAt: '2026-09-02T11:00:00Z' }],
  follows:[{ id: 'f1', followerName: 'Dom R.', followeeName: 'Rae K.', createdAt: '2026-09-02T09:00:00Z' }],
};

describe('activity feed', () => {
  it('derives entries from real rows', () => {
    const feed = buildFeed(src);
    expect(feed).toHaveLength(3);
    expect(feed.map((e) => e.kind).sort()).toEqual(['card_pulled', 'followed', 'reign_won']);
  });

  it('orders newest first', () => {
    expect(buildFeed(src).map((e) => e.id)).toEqual(['p1', 'r1', 'f1']);
  });

  it('names the real actor, never a fixture', () => {
    const e = buildFeed(src).find((x) => x.kind === 'reign_won')!;
    expect(e.actorName).toBe('Rae K.');
    expect(e.subject).toContain('Naatu Naatu');
  });

  it('surfaces a peak moment as its own kind', () => {
    const feed = buildFeed({ ...src, reigns: [{ ...src.reigns[0], peakVibe: 100 }] });
    expect(feed.some((e) => e.kind === 'peak_moment')).toBe(true);
  });

  it('returns an empty feed for empty sources, not placeholders', () => {
    expect(buildFeed({ reigns: [], pulls: [], follows: [] })).toEqual([]);
  });

  it('honours the limit', () => {
    expect(buildFeed(src, 2)).toHaveLength(2);
  });
});

/*
  The feed's kinds and the screen's colours must not drift apart.

  /social keyed its accent colours as Record<string, string>, so any key
  typechecked -- including ones the feed never emits. That is how it ended up
  carrying keys from a THIRD vocabulary: the `activity` table's own check
  constraint names `started_following`, `event_created` and `event_live`,
  none of which buildFeed produces. Nothing reconciled the two, because
  nothing could.

  The map is now keyed by ActivityKind so the compiler catches a missing
  colour. This test catches the other direction -- a kind that gets added to
  the union and emitted, but that the screen has no colour for.
*/
describe('feed kinds stay in step with the screen', () => {
  it('emits only kinds the accent map covers', () => {
    const emitted = new Set(buildFeed(src).map((e) => e.kind));
    // A peak moment only appears above the vibe threshold, so it needs its
    // own source row rather than the shared fixture.
    emitted.add(
      buildFeed({
        ...src,
        reigns: [{ ...src.reigns[0], peakVibe: 100 }],
      }).find((e) => e.kind === 'peak_moment')!.kind,
    );

    for (const kind of emitted) {
      expect(KIND_ACCENT[kind], `no accent colour for "${kind}"`).toBeTruthy();
    }
  });
});
