import { describe, it, expect } from 'vitest';
import { startReign, tickReign, isPeakMoment, COLLAPSE_THRESHOLD } from './reign';

const opts = (over = {}) => ({
  control: 'contested' as const, stamina: 60, crowdPull: 0, deltaMs: 1000, now: 1000, ...over,
});

describe('reign lifecycle', () => {
  it('starts at the card hype and records it as the peak', () => {
    const r = startReign(82, 0);
    expect(r.vibe).toBe(82);
    expect(r.peakVibe).toBe(82);
    expect(r.endedReason).toBeNull();
  });

  it('decays over time when the crowd is silent', () => {
    const r = tickReign(startReign(50, 0), opts());
    expect(r.vibe).toBeLessThan(50);
  });

  it('decays more slowly at higher stamina', () => {
    const weak = tickReign(startReign(50, 0), opts({ stamina: 20 }));
    const tough = tickReign(startReign(50, 0), opts({ stamina: 95 }));
    expect(tough.vibe).toBeGreaterThan(weak.vibe);
  });

  it('tracks the peak across the reign', () => {
    let r = startReign(40, 0);
    r = tickReign(r, opts({ crowdPull: 30 }));
    const peak = r.peakVibe;
    r = tickReign(r, opts({ crowdPull: -30 }));
    expect(r.peakVibe).toBe(peak);
    expect(r.vibe).toBeLessThan(peak);
  });

  // CLAUDE.md §1: collapse hands over the throne in a contested room.
  it('collapses a contested reign below the threshold', () => {
    let r = startReign(COLLAPSE_THRESHOLD + 1, 0);
    for (let i = 0; i < 200 && !r.endedReason; i++) r = tickReign(r, opts({ now: i * 1000 }));
    expect(r.endedReason).toBe('collapsed');
  });

  // §1.2: the hard rule. Low vibe is a weak set, never a forfeit.
  it('NEVER ends a spectator set, however low the vibe falls', () => {
    let r = startReign(20, 0);
    for (let i = 0; i < 500; i++) r = tickReign(r, opts({ control: 'spectator', now: i * 1000 }));
    expect(r.endedReason).toBeNull();
    expect(r.vibe).toBe(0);
  });

  it('never ends a delegated reign either — the DJ keeps control', () => {
    let r = startReign(20, 0);
    for (let i = 0; i < 500; i++) r = tickReign(r, opts({ control: 'delegated', now: i * 1000 }));
    expect(r.endedReason).toBeNull();
  });

  it('clamps the vibe to 0..100', () => {
    const hi = tickReign(startReign(99, 0), opts({ crowdPull: 999 }));
    expect(hi.vibe).toBeLessThanOrEqual(100);
    const lo = tickReign(startReign(2, 0), opts({ crowdPull: -999, control: 'spectator' }));
    expect(lo.vibe).toBeGreaterThanOrEqual(0);
  });

  it('flags a peak moment only at the very top', () => {
    expect(isPeakMoment({ ...startReign(100, 0), vibe: 100 })).toBe(true);
    expect(isPeakMoment({ ...startReign(90, 0), vibe: 90 })).toBe(false);
  });
});
