'use client';

/**
 * Card pool loader.
 *
 * Supabase is the only source. There used to be a seed-pool fallback here,
 * on the reasoning that a party app which blanks on bad venue wifi is worse
 * than one showing slightly stale cards. That reasoning was sound and the
 * implementation did not deliver it: the fixture ids are `gen-000`-style
 * strings while every real card id is a uuid, so the two pools share not one
 * id.
 *
 * The place that mattered is the pack reveal, which looks up the ids the
 * server just granted (app/packs/page.tsx). Against the fixture pool every
 * one of those lookups returned undefined, so the "graceful degradation" was
 * a blank reveal wearing a full binder's clothes. Worse than an honest error,
 * because nothing on screen said anything was wrong.
 *
 * So: no fallback, and `source` reports what actually happened. Screens
 * render an empty or error state and say so.
 */

import { useEffect, useState } from 'react';
import type { SongCard } from '@/types/cards';
import { fetchCards, dbCardToSongCard, isSupabaseConfigured } from './supabase';

export type CardSource = 'loading' | 'live' | 'empty' | 'error';

export function useCards() {
  const [cards, setCards] = useState<SongCard[]>([]);
  // With no database configured there is nothing to wait for, and nothing
  // to show either.
  const [source, setSource] = useState<CardSource>(
    isSupabaseConfigured ? 'loading' : 'error',
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    fetchCards()
      .then((rows) => {
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setCards(rows.map(dbCardToSongCard) as SongCard[]);
          setSource('live');
        } else {
          // An empty table and an unreachable one are different problems and
          // deserve different words on screen.
          setSource(rows ? 'empty' : 'error');
        }
      })
      .catch(() => {
        if (!cancelled) setSource('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { cards, source, isLive: source === 'live' };
}

export const SOURCE_LABEL: Record<CardSource, { text: string; color: string }> = {
  loading: { text: 'LOADING POOL…', color: 'var(--ink-40)' },
  live: { text: 'LIVE POOL', color: 'var(--neon-mint)' },
  empty: { text: 'NO CARDS MINTED', color: 'var(--ink-40)' },
  error: { text: 'POOL UNREACHABLE', color: 'var(--neon-pink)' },
};
