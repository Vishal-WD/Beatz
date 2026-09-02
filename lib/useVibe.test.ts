import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVibe } from './useVibe';

describe('useVibe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the card hype', () => {
    const { result } = renderHook(() => useVibe({ stamina: 60, hype: 80, control: 'contested' }));
    expect(result.current.vibe).toBe(80);
  });

  // The hook must not re-implement the rule; it delegates to the domain.
  it('never reports an ended reign in a spectator room', () => {
    const { result } = renderHook(() =>
      useVibe({ stamina: 1, hype: 16, control: 'spectator', soloPractice: false }),
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.ended).toBeNull();
  });

  // CLAUDE.md §1: the whole point of a contested room.
  it('reports a collapsed reign in a contested room once vibe falls low enough', () => {
    const { result } = renderHook(() =>
      useVibe({ stamina: 1, hype: 16, control: 'contested', soloPractice: false }),
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.ended).toBe('collapsed');
  });
});
