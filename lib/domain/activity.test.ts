import { describe, it, expect } from 'vitest';
import { buildFeed } from './activity';

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
