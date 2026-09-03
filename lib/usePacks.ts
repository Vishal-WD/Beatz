'use client';

/**
 * Pack opening.
 *
 * The screen had a tear animation and nothing behind it: no spend, no
 * pull, no card added to a collection. Tearing is now the purchase, and
 * which tier was torn decides what it costs and what it contains.
 */

import { useCallback, useState } from 'react';
import { openPack, type PackPull } from './supabase';
import { canAfford, PACKS, type PackTier } from './domain/packs';
import { useAuth } from './useAuth';

export type PackState = 'idle' | 'opening' | 'opened' | 'error';

export function usePacks() {
  const { profile, isSignedIn } = useAuth();
  const [pulls, setPulls] = useState<PackPull[] | null>(null);
  const [openedTier, setOpenedTier] = useState<PackTier | null>(null);
  const [state, setState] = useState<PackState>('idle');
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (tier: PackTier) => {
    // Guard re-entry: the pack is one big tap target and a double tap
    // must not bill two packs.
    if (state === 'opening') return;
    setState('opening');
    setError(null);
    setOpenedTier(tier);

    const res = await openPack(tier);
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
    setOpenedTier(null);
    setError(null);
    setState('idle');
  }, []);

  const drops = profile.drops ?? 0;

  return {
    open,
    reset,
    pulls,
    openedTier,
    state,
    error,
    busy: state === 'opening',
    drops,
    isSignedIn,
    affordable: (tier: PackTier) => isSignedIn && canAfford(drops, tier),
  };
}
