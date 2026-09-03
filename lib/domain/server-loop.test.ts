/**
 * The rule the socket server used to break.
 *
 * Its tick loop did its own decay arithmetic and dethroned whenever the
 * vibe fell below a threshold, in EVERY room — so a Concert or Clubbing
 * set ended on vibe collapse, which CLAUDE.md §1.2 forbids. These tests
 * pin the shared behaviour the server now delegates to.
 */
import { describe, it, expect } from 'vitest';
import { startReign, tickReign } from './reign';
import { controlModelFor } from './formats';
import type { FormatId } from './formats';

/** Run a reign to exhaustion the way the server's interval does. */
function runToCollapse(format: FormatId, ticks = 600) {
  let s = startReign(60, 0);
  for (let i = 0; i < ticks && !s.endedReason; i++) {
    s = tickReign(s, {
      control: controlModelFor(format),
      stamina: 50,
      crowdPull: 0,
      deltaMs: 420,
      now: i * 420,
    });
  }
  return s;
}

describe('server tick, per control model', () => {
  it('ends a contested reign — the throne changes hands', () => {
    expect(runToCollapse('disco').endedReason).toBe('collapsed');
    expect(runToCollapse('private_party').endedReason).toBe('collapsed');
  });

  it('NEVER ends a spectator set, however far the vibe falls', () => {
    for (const f of ['concert', 'fest', 'clubbing'] as FormatId[]) {
      const s = runToCollapse(f);
      expect(s.endedReason).toBeNull();
      expect(s.vibe).toBe(0);
    }
  });

  it('never ends a delegated set — the DJ keeps control', () => {
    const s = runToCollapse('night_party');
    expect(s.endedReason).toBeNull();
  });

  it('still scores a spectator set: the peak is recorded', () => {
    let s = startReign(40, 0);
    s = tickReign(s, { control: 'spectator', stamina: 50, crowdPull: 60, deltaMs: 420, now: 420 });
    expect(s.peakVibe).toBeGreaterThan(40);
  });
});
