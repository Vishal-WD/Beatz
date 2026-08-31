'use client';

/**
 * Card pool loader.
 *
 * Supabase is the source of truth when reachable; the generated seed pool is
 * the fallback. The app must never show an empty binder because a database
 * was slow — a party app that blanks on bad venue wifi is worse than one
 * showing slightly stale cards.
 */

import { useEffect, useState } from 'react';
import type { SongCard } from '@/types/cards';
import { ALL_CARDS as SEEDED } from './seed-data';
import { fetchCards, dbCardToSongCard, isSupabaseConfigured } from './supabase';

export type CardSource = 'loading' | 'live' | 'seeded';

export function useCards() {
  const [cards, setCards] = useState<SongCard[]>(SEEDED);
  const [source, setSource] = useState<CardSource>(
    isSupabaseConfigured ? 'loading' : 'seeded',
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    fetchCards()
      .then((rows) => {
        if (cancelled) return;
        // An empty table is not a reason to blank the app — keep the seed
        // pool and stay honest about which one is showing.
        if (rows && rows.length > 0) {
          setCards(rows.map(dbCardToSongCard) as SongCard[]);
          setSource('live');
        } else {
          setSource('seeded');
        }
      })
      .catch(() => {
        if (!cancelled) setSource('seeded');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { cards, source, isLive: source === 'live' };
}

export const SOURCE_LABEL: Record<CardSource, { text: string; color: string }> = {
  loading: { text: 'LOADING POOL…', color: 'rgba(244,242,255,.4)' },
  live: { text: 'LIVE POOL', color: '#7dffc3' },
  seeded: { text: 'LOCAL POOL', color: '#4ce3ff' },
};
