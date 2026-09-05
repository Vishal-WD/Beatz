import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
  The bug this pins.

  useAuth() held its state in plain useState, so EVERY call site got an
  independent copy with its own profile and its own fetch. The shop screen
  calls useAuth() once and usePacks() calls it again, so refreshing the
  profile after a spin updated one copy while the balance on screen came
  from the other. The Drops only appeared after navigating away and back,
  because that remounted the second copy and made it refetch. The welcome
  screen called it three times.

  Asserting on the source rather than by rendering two components: the rule
  worth holding is structural — the profile lives in ONE place — and a
  render test would pass just as well against two stores that happened to
  fetch the same value.
*/
describe('useAuth shares one profile across call sites', () => {
  const src = readFileSync(join(process.cwd(), 'lib', 'useAuth.ts'), 'utf8');
  const hook = src.slice(src.indexOf('export function useAuth()'));

  it('subscribes to an external store rather than holding local state', () => {
    expect(hook).toMatch(/useSyncExternalStore\(/);
  });

  it('does not keep the profile in per-call useState', () => {
    // useState<DbProfile> inside the hook is exactly the shape that made
    // every consumer independent.
    expect(hook).not.toMatch(/useState<DbProfile>/);
    expect(hook).not.toMatch(/useState<AuthState>/);
  });

  it('installs the session listener once, not once per mount', () => {
    // Several mounted hooks used to mean several subscriptions and several
    // redundant fetches of the same session.
    expect(src).toMatch(/let wired = false/);
    expect(src).toMatch(/function ensureWired/);
  });

  it('exposes a refresh that updates the shared snapshot', () => {
    expect(src).toMatch(/export async function refreshAuthProfile/);
    // …and the hook's own refreshProfile must delegate to it rather than
    // re-implementing a private load.
    expect(hook).toMatch(/refreshAuthProfile\(\)/);
  });

  it('notifies subscribers with a new object identity', () => {
    // Mutating the snapshot in place would leave useSyncExternalStore
    // convinced nothing had changed, which is the same stale-balance bug
    // wearing a different mask.
    expect(src).toMatch(/snapshot = \{ \.\.\.snapshot, \.\.\.patch \}/);
  });
});
