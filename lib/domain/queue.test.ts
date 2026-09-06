import { describe, it, expect } from 'vitest';
import {
  addToQueue, removeFromQueue, voteFor, playOrder, nextUp,
  canQueue, canSkip, QUEUE_MAX, PER_PLAYER_MAX, type QueueEntry,
} from './queue';

/*
  What this pins.

  A room could only ever play one song. Playing while somebody held the
  throne was refused (`THRONE_HELD`), and when a reign ended the room went
  silent -- endReign nulled the reign and nothing followed. The Challenger
  Line was no help: it queues PEOPLE, and a challenger carries no card, so
  when the throne freed up nothing knew what to play.

  These tests hold the queue to the three control models in CLAUDE.md §1.1.
  The rule that matters most is the Spectator one: if the crowd can queue in
  a Concert, the format has quietly become Contested, and §1 says adding a
  fourth control model is drift rather than a feature.
*/

let seq = 0;
const entry = (over: Partial<QueueEntry> = {}): QueueEntry => ({
  id: `e${++seq}`,
  cardId: `card-${seq}`,
  playerId: 'p1',
  displayName: 'Rae',
  cardTitle: 'Song',
  cardArtist: 'Artist',
  hype: 70,
  stamina: 60,
  votes: [],
  addedAt: seq * 1000,
  ...over,
});

describe('who may queue (CLAUDE.md §1.1)', () => {
  it('lets anyone queue in a contested room', () => {
    expect(canQueue('disco', false)).toBe(true);
    expect(canQueue('private_party', false)).toBe(true);
  });

  it('lets the crowd offer songs in a delegated room', () => {
    // The crowd feeds the pool; the DJ picks from it. Offering is the point.
    expect(canQueue('night_party', false)).toBe(true);
  });

  it('does NOT let the crowd queue in a spectator room', () => {
    // A Concert whose crowd queues is a Disco with extra steps.
    expect(canQueue('concert', false)).toBe(false);
    expect(canQueue('fest', false)).toBe(false);
    expect(canQueue('clubbing', false)).toBe(false);
  });

  it('lets the host queue in a spectator room', () => {
    expect(canQueue('concert', true)).toBe(true);
  });

  it('refuses a crowd add with a reason, rather than dropping it', () => {
    const res = addToQueue([], entry(), { format: 'concert', isHost: false });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('crowd_cannot_queue');
  });
});

describe('adding', () => {
  it('appends when allowed', () => {
    const res = addToQueue([], entry(), { format: 'disco', isHost: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.queue).toHaveLength(1);
  });

  it('refuses the same card twice', () => {
    const a = entry({ cardId: 'same' });
    const res = addToQueue([a], entry({ cardId: 'same' }), { format: 'disco', isHost: false });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('already_queued');
  });

  it('stops one player filling the night', () => {
    let q: QueueEntry[] = [];
    for (let i = 0; i < PER_PLAYER_MAX; i++) {
      const r = addToQueue(q, entry({ playerId: 'hog' }), { format: 'disco', isHost: false });
      expect(r.ok).toBe(true);
      if (r.ok) q = r.queue;
    }
    const over = addToQueue(q, entry({ playerId: 'hog' }), { format: 'disco', isHost: false });
    expect(over.ok).toBe(false);

    // ...but somebody else can still get in.
    const other = addToQueue(q, entry({ playerId: 'someone-else' }), { format: 'disco', isHost: false });
    expect(other.ok).toBe(true);
  });

  it('has a ceiling', () => {
    const q = Array.from({ length: QUEUE_MAX }, (_, i) =>
      entry({ playerId: `p${i}`, cardId: `c${i}` }));
    const res = addToQueue(q, entry({ playerId: 'late' }), { format: 'disco', isHost: false });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('queue_full');
  });
});

describe('removing', () => {
  it('lets you take back your own', () => {
    const mine = entry({ playerId: 'me' });
    const res = removeFromQueue([mine], mine.id, 'me', false);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.queue).toHaveLength(0);
  });

  it('does not let you remove someone else’s', () => {
    const theirs = entry({ playerId: 'them' });
    const res = removeFromQueue([theirs], theirs.id, 'me', false);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('not_yours');
  });

  it('lets the host clear anything in their room', () => {
    const theirs = entry({ playerId: 'them' });
    const res = removeFromQueue([theirs], theirs.id, 'host', true);
    expect(res.ok).toBe(true);
  });

  it('treats an already-removed entry as done, not as an error', () => {
    // Two people tapping remove at once must not produce a failure.
    const res = removeFromQueue([], 'gone', 'me', false);
    expect(res.ok).toBe(true);
  });
});

describe('play order', () => {
  it('is arrival order in a contested room', () => {
    const first = entry({ addedAt: 1 });
    const second = entry({ addedAt: 2 });
    // Votes must NOT reorder a contested queue: the throne is won by
    // playing, not by lobbying.
    const voted = { ...second, votes: ['a', 'b', 'c'] };
    expect(playOrder([voted, first], 'disco').map((q) => q.id))
      .toEqual([first.id, voted.id]);
  });

  it('is support order in a delegated room', () => {
    const quiet = entry({ addedAt: 1 });
    const wanted = entry({ addedAt: 2, votes: ['a', 'b'] });
    expect(playOrder([quiet, wanted], 'night_party')[0].id).toBe(wanted.id);
  });

  it('counts a person once however many times they tap', () => {
    const spammed = entry({ votes: ['a', 'a', 'a', 'a'] });
    const genuine = entry({ addedAt: 999, votes: ['x', 'y'] });
    expect(playOrder([spammed, genuine], 'night_party')[0].id).toBe(genuine.id);
  });

  it('breaks ties the same way for every client', () => {
    // Two phones sorting the same rows must agree, or the room disagrees
    // with itself about what is playing next.
    const a = entry({ id: 'aaa', addedAt: 5, votes: ['x'] });
    const b = entry({ id: 'bbb', addedAt: 5, votes: ['y'] });
    expect(playOrder([a, b], 'night_party').map((q) => q.id))
      .toEqual(playOrder([b, a], 'night_party').map((q) => q.id));
  });

  it('does not mutate the queue it was given', () => {
    const q = [entry({ addedAt: 2 }), entry({ addedAt: 1 })];
    const before = q.map((e) => e.id);
    playOrder(q, 'disco');
    expect(q.map((e) => e.id)).toEqual(before);
  });
});

describe('what plays next', () => {
  it('is nothing when the queue is empty', () => {
    expect(nextUp([], 'disco')).toBeNull();
  });

  it('is the head of the play order', () => {
    const first = entry({ addedAt: 1 });
    const later = entry({ addedAt: 2 });
    expect(nextUp([later, first], 'disco')?.id).toBe(first.id);
  });
});

describe('voting', () => {
  it('toggles rather than accumulating', () => {
    const e = entry();
    const once = voteFor([e], e.id, 'me');
    expect(once[0].votes).toEqual(['me']);
    const twice = voteFor(once, e.id, 'me');
    expect(twice[0].votes).toEqual([]);
  });

  it('leaves other entries alone', () => {
    const a = entry();
    const b = entry();
    const out = voteFor([a, b], a.id, 'me');
    expect(out[1].votes).toEqual([]);
  });
});

describe('skipping', () => {
  it('is impossible in a contested room', () => {
    // A skip button here would be a dethrone that bypassed the crowd --
    // exactly what the contested model exists to prevent.
    expect(canSkip('disco', { isHost: true, holdsThrone: true })).toBe(false);
  });

  it('is the performer’s right in delegated and spectator rooms', () => {
    expect(canSkip('night_party', { isHost: false, holdsThrone: true })).toBe(true);
    expect(canSkip('concert', { isHost: true, holdsThrone: false })).toBe(true);
  });

  it('is not available to a listener', () => {
    expect(canSkip('concert', { isHost: false, holdsThrone: false })).toBe(false);
  });
});
