'use client';

/**
 * Pack opening.
 *
 * The screen had a four-stage tear animation but nothing behind it: it
 * picked a legendary out of the global pool to display, spent no Drops,
 * claimed no supply, and added nothing to anyone's collection. Tapping it a
 * hundred times changed nothing.
 *
 * The spend and the pull both happen server-side in `open_pack` — see
 * `openPack` in lib/supabase.ts for why that cannot be done from here.
 */

import { useCallback, useState } from 'react';
import { openPack, type PackPull } from './supabase';
import { canAfford, PACKS } from './domain/packs';
import { useAuth } from './useAuth';

export type PackState = 'idle' | 'opening' | 'opened' | 'error';

export function usePacks() {
  const { profile, isSignedIn } = useAuth();
  const [pulls, setPulls] = useState<PackPull[] | null>(null);
  const [state, setState] = useState<PackState>('idle');
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async () => {
    // Guard re-entry: the screen is one big tap target, and a double tap
    // must not bill two packs.
    if (state === 'opening') return;
    setState('opening');
    setError(null);

    const res = await openPack();
    if ('error' in res) {
      setError(res.error);
      setState('error');
      return;
    }
    setPulls(res);
    setState('opened');
  }, [state]);

  const reset = useCallback(() => {
    setPulls(null);
    setError(null);
    setState('idle');
  }, []);

  return {
    open,
    reset,
    pulls,
    state,
    error,
    busy: state === 'opening',
    /** Drops the player actually holds, so the screen can price the pack. */
    drops: profile.drops ?? 0,
    cost: PACKS.night.cost,
    isSignedIn,
    affordable: isSignedIn && canAfford(profile.drops ?? 0, 'night'),
  };
}
