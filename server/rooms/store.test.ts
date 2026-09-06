import { describe, it, expect, beforeEach } from 'vitest';
import { RoomStore } from './store';
import type { ServerCard } from '../db/reigns';

/*
  The behaviour that made a room feel dead.

  A room could play exactly one song. Playing while somebody held the throne
  was refused with THRONE_HELD, and when a reign ended endReign nulled it and
  left silence -- so every song was followed by dead air until a human
  noticed. The Challenger Line did not help: it queues PEOPLE, and a
  challenger carries no card, so nothing knew what to play next.

  These pin the handoff: a second play queues, and the end of a reign
  promotes the queue rather than going quiet.
*/

const card = (over: Partial<ServerCard> = {}): ServerCard => ({
  id: 'c1',
  kind: 'song',
  title: 'First Song',
  subtitle: 'Artist',
  hype: 70,
  stamina: 60,
  ...over,
});

describe('queue takes over when a reign ends', () => {
  let store: RoomStore;

  beforeEach(() => {
    store = new RoomStore();
    store.ensure('room', 'casual', 'disco');
    store.addPlayer('room', { id: 'a', displayName: 'Ana' });
    store.addPlayer('room', { id: 'b', displayName: 'Ben' });
  });

  it('starts a reign for the first card played', () => {
    const res = store.playCard('room', 'a', card());
    expect('reign' in res).toBe(true);
    if ('reign' in res) expect(res.reign.cardTitle).toBe('First Song');
  });

  it('queues the second card instead of refusing it', () => {
    store.playCard('room', 'a', card());
    const res = store.playCard('room', 'b', card({ id: 'c2', title: 'Second Song' }));

    // The old behaviour was { error: THRONE_HELD }, which stopped the night.
    expect('queued' in res).toBe(true);
    if ('queued' in res) expect(res.queued.cardTitle).toBe('Second Song');
    expect(store.ensure('room').queue).toHaveLength(1);
  });

  it('promotes the queue when the reign ends, rather than falling silent', () => {
    store.playCard('room', 'a', card());
    store.playCard('room', 'b', card({ id: 'c2', title: 'Second Song' }));

    const promoted = store.endReign('room', 'dethroned');

    expect(promoted).not.toBeNull();
    expect(promoted?.cardTitle).toBe('Second Song');
    expect(promoted?.playerId).toBe('b');
    // The room keeps playing: reign is set, not null.
    expect(store.ensure('room').reign?.cardId).toBe('c2');
    // ...and the entry is consumed, not played twice.
    expect(store.ensure('room').queue).toHaveLength(0);
  });

  it('falls silent only when the queue is genuinely empty', () => {
    store.playCard('room', 'a', card());
    expect(store.endReign('room', 'dethroned')).toBeNull();
    expect(store.ensure('room').reign).toBeNull();
  });

  it('gives the promoted reign the queued card’s own stats', () => {
    store.playCard('room', 'a', card());
    store.playCard('room', 'b', card({ id: 'c2', hype: 95, stamina: 30 }));

    const promoted = store.endReign('room', 'dethroned');
    // Not the outgoing card's numbers, and not a default.
    expect(promoted?.decayRate).toBe(30);
  });

  it('plays a contested queue in arrival order', () => {
    store.addPlayer('room', { id: 'c', displayName: 'Cal' });
    store.playCard('room', 'a', card());
    store.playCard('room', 'b', card({ id: 'c2', title: 'Second' }));
    store.playCard('room', 'c', card({ id: 'c3', title: 'Third' }));

    expect(store.endReign('room', 'dethroned')?.cardTitle).toBe('Second');
    expect(store.endReign('room', 'dethroned')?.cardTitle).toBe('Third');
    expect(store.endReign('room', 'dethroned')).toBeNull();
  });
});

describe('who may queue, per control model (CLAUDE.md §1.1)', () => {
  it('refuses the crowd in a spectator room', () => {
    const store = new RoomStore();
    const room = store.ensure('concert', 'casual', 'concert');
    room.hostId = 'host';
    store.addPlayer('concert', { id: 'host', displayName: 'Host' });
    store.addPlayer('concert', { id: 'fan', displayName: 'Fan' });

    store.playCard('concert', 'host', card());
    const res = store.playCard('concert', 'fan', card({ id: 'c2' }));

    // A Concert whose crowd queues has quietly become a Disco.
    expect('error' in res).toBe(true);
    if ('error' in res) expect(res.error.code).toBe('CROWD_CANNOT_QUEUE');
  });

  it('lets the host queue in a spectator room', () => {
    const store = new RoomStore();
    const room = store.ensure('concert', 'casual', 'concert');
    room.hostId = 'host';
    store.addPlayer('concert', { id: 'host', displayName: 'Host' });

    store.playCard('concert', 'host', card());
    const res = store.playCard('concert', 'host', card({ id: 'c2' }));
    expect('queued' in res).toBe(true);
  });
});
