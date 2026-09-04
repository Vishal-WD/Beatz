'use client';

/**
 * The FEED tab's tiles — tonight's events, illustrated by what was played.
 *
 * Shaped like useActivityFeed: fetch on mount, cancel on unmount, and one
 * of three states so the screen can tell "still loading" from "genuinely
 * nothing scheduled". An unreachable backend reads as empty rather than
 * as placeholder tiles, which is the fixture problem this redesign removes.
 */

import { useEffect, useState } from 'react';
import type { FeedTile } from './domain/collage';
import { fetchFeedTiles } from './supabase';

export type FeedTilesState = 'loading' | 'live' | 'empty';

export function useFeed() {
  const [tiles, setTiles] = useState<FeedTile[]>([]);
  const [state, setState] = useState<FeedTilesState>('loading');

  useEffect(() => {
    let cancelled = false;
    void fetchFeedTiles().then((rows) => {
      if (cancelled) return;
      const next = rows ?? [];
      setTiles(next);
      setState(next.length ? 'live' : 'empty');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tiles, state };
}
