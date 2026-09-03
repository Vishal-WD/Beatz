import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from './useAuth';

describe('useAuth loading state', () => {
  /*
    The bug this pins: every screen read `isSignedIn`, which is
    `state === 'signed-in'` and therefore FALSE while the session is still
    resolving. So each screen rendered its signed-out view for a beat, and
    the app flashed "sign in" on every load.

    A screen needs to distinguish "not signed in" from "not known yet".
  */
  it('reports loading separately from anonymous', () => {
    const { result } = renderHook(() => useAuth());
    // Before the session resolves, the hook must NOT claim the user is
    // anonymous — only that the answer is not known.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAnonymous).toBe(false);
    expect(result.current.isSignedIn).toBe(false);
  });

  it('never reports loading and anonymous at the same time', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading && result.current.isAnonymous).toBe(false);
  });

  it('never reports loading and signed-in at the same time', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading && result.current.isSignedIn).toBe(false);
  });
});
